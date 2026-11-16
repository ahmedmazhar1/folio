"""Validated enquiry intake with durable local storage and optional email delivery.

The default saves enquiries only. Set ENQUIRY_EMAIL_PROVIDER=formsubmit and
ENQUIRY_EMAIL_ACTIVATED=true after the recipient activates that service.
"""
import hashlib,json,os,re,sqlite3,time,uuid
from contextlib import contextmanager
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import URLError,HTTPError

DEFAULT_RECIPIENT='theahmedmazhar@gmail.com'

class EnquiryInvalid(ValueError):pass
class EnquiryRateLimited(ValueError):pass

def clean_text(value,label,maximum,required=False):
    if value is None:value=''
    if not isinstance(value,str):raise EnquiryInvalid(label+' must be text.')
    value=value.strip()
    if len(value)>maximum:raise EnquiryInvalid(label+' is too long.')
    if required and len(value)<2:raise EnquiryInvalid('Please enter '+label.lower()+'.')
    if '\x00' in value:raise EnquiryInvalid(label+' contains an invalid character.')
    return value

def validate_enquiry(data,estimate_items):
    if not isinstance(data,dict):raise EnquiryInvalid('Send an enquiry object.')
    name=clean_text(data.get('name'),'Name',100,True)
    email=clean_text(data.get('email'),'Email',254,True)
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email):raise EnquiryInvalid('Please enter a valid email address.')
    city=clean_text(data.get('city'),'Delivery city',100,True)
    phone=clean_text(data.get('phone'),'Phone',40)
    company=clean_text(data.get('company'),'Company',120)
    message=clean_text(data.get('message',data.get('notes')),'Message',5000)
    needed_by=clean_text(data.get('neededBy'),'Needed-by date',40)
    if needed_by and not re.fullmatch(r'\d{4}-\d{2}-\d{2}',needed_by):raise EnquiryInvalid('Needed-by date must use YYYY-MM-DD.')
    request_id=data.get('requestId') or str(uuid.uuid4())
    if not isinstance(request_id,str) or not re.fullmatch(r'[A-Za-z0-9_-]{8,80}',request_id):raise EnquiryInvalid('Invalid enquiry request ID.')
    items=data.get('items',[])
    if not isinstance(items,list) or len(items)>100:raise EnquiryInvalid('Choose no more than 100 product configurations.')
    for item in items:
        if not isinstance(item,dict):raise EnquiryInvalid('Each product configuration must be an object.')
        item['notes']=clean_text(item.get('notes'),'Product notes',500)
    estimate=estimate_items({'items':items}) if items else None
    if not items and len(message)<10:raise EnquiryInvalid('Tell us a little more about what you need (at least 10 characters).')
    return dict(name=name,email=email,city=city,phone=phone,company=company,message=message,neededBy=needed_by,
                requestId=request_id,items=items,estimate=estimate)

def database_path():
    directory=Path(os.environ.get('ECOPAK_DATA_DIR',str(Path(__file__).resolve().parent/'.data')))
    directory.mkdir(parents=True,exist_ok=True,mode=0o700)
    return directory/'enquiries.sqlite3'

@contextmanager
def connect():
    connection=sqlite3.connect(database_path(),timeout=10)
    connection.row_factory=sqlite3.Row
    connection.execute('PRAGMA journal_mode=WAL')
    connection.executescript('''
      CREATE TABLE IF NOT EXISTS enquiries (
        id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL,
        created_epoch INTEGER NOT NULL, contact_json TEXT NOT NULL, items_json TEXT NOT NULL,
        estimate_json TEXT, client_hash TEXT NOT NULL, email_status TEXT NOT NULL,
        delivery_error TEXT
      );
      CREATE INDEX IF NOT EXISTS enquiries_recent_client ON enquiries(client_hash,created_epoch);
    ''')
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:connection.close()

def email_configuration():
    path=Path(__file__).resolve().parent/'backend-config.json'
    setting=json.loads(path.read_text()) if path.is_file() else {}
    return dict(provider=os.environ.get('ENQUIRY_EMAIL_PROVIDER',setting.get('emailProvider','')).lower(),
                recipient=os.environ.get('ENQUIRY_RECIPIENT',setting.get('recipient',DEFAULT_RECIPIENT)),
                activated=str(os.environ.get('ENQUIRY_EMAIL_ACTIVATED',setting.get('emailActivated',False))).lower()=='true')

def dispatch_email(enquiry,enquiry_id):
    """A provider acknowledgement is not a claim of mailbox delivery."""
    config=email_configuration()
    if not config['provider']:return 'not_configured',None
    if config['provider']!='formsubmit':return 'not_configured','Unsupported email provider.'
    if not config['activated']:return 'activation_required',None
    if not re.fullmatch(r'[^\s@/]+@[^\s@/]+\.[^\s@/]+',config['recipient']):return 'failed','Invalid recipient configuration.'
    summary=[]
    for i,line in enumerate((enquiry.get('estimate') or {}).get('lines',[])):
        item_note=enquiry['items'][i].get('notes','')
        stock=' | availability to confirm' if line.get('available') is False else ''
        summary.append(f"{line['name']} | {line['optionLabel']} | quantity {line['quantity']} | {'custom quote' if line['quoteRequired'] else str(line['guideTotal'])+' PKR'}{stock}"+((' | '+item_note) if item_note else ''))
    payload=dict(name=enquiry['name'],email=enquiry['email'],phone=enquiry['phone'],company=enquiry['company'],
                 city=enquiry['city'],needed_by=enquiry['neededBy'],message=enquiry['message'],
                 products='\n'.join(summary),reference=enquiry_id,_subject='PanniPack enquiry '+enquiry_id,
                 _replyto=enquiry['email'],_template='table')
    request=Request('https://formsubmit.co/ajax/'+config['recipient'],data=json.dumps(payload).encode(),
                    headers={'Content-Type':'application/json','Accept':'application/json','User-Agent':'EcoPak-Enquiries/1.0'},method='POST')
    try:
        with urlopen(request,timeout=8) as response:body=json.load(response)
        if body.get('success') in (True,'true'):return 'provider_accepted',None
        return 'failed','Email provider did not acknowledge the enquiry.'
    except (URLError,HTTPError,TimeoutError,ValueError):return 'failed','Email provider was unavailable. Enquiry remains saved.'

def receipt(row):
    return dict(enquiryId=row['id'],status='received',stored=True,emailStatus=row['email_status'],
                message='Your enquiry has been received. Keep this reference: '+row['id']+'.')

def submit_enquiry(data,client,estimate_items):
    if isinstance(data,dict) and data.get('website'):return dict(status='received',stored=False,emailStatus='not_sent',message='Thank you.')
    enquiry=validate_enquiry(data,estimate_items)
    now=int(time.time());created=datetime.now(timezone.utc).isoformat();client_hash=hashlib.sha256(client.encode()).hexdigest()
    with connect() as connection:
        connection.execute('BEGIN IMMEDIATE')
        existing=connection.execute('SELECT id,email_status FROM enquiries WHERE request_id=?',(enquiry['requestId'],)).fetchone()
        if existing:return receipt(existing)
        count=connection.execute('SELECT COUNT(*) FROM enquiries WHERE client_hash=? AND created_epoch>?',(client_hash,now-600)).fetchone()[0]
        if count>=5:raise EnquiryRateLimited('Too many enquiries. Please try again in a few minutes.')
        enquiry_id='EP-'+uuid.uuid4().hex[:12].upper()
        contact={k:enquiry[k] for k in ['name','email','city','phone','company','message','neededBy']}
        connection.execute('INSERT INTO enquiries(id,request_id,created_at,created_epoch,contact_json,items_json,estimate_json,client_hash,email_status) VALUES(?,?,?,?,?,?,?,?,?)',
                           (enquiry_id,enquiry['requestId'],created,now,json.dumps(contact),json.dumps(enquiry['items']),json.dumps(enquiry['estimate']),client_hash,'pending'))
    status,error=dispatch_email(enquiry,enquiry_id)
    with connect() as connection:connection.execute('UPDATE enquiries SET email_status=?,delivery_error=? WHERE id=?',(status,error,enquiry_id))
    return receipt({'id':enquiry_id,'email_status':status})
