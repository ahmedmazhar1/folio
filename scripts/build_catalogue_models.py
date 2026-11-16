#!/usr/bin/env python3
"""Build connected visual fold studies at each saved catalogue option's size.

Only existing, explicitly mapped local structures are used. These graphs are
visual candidates, never a claim that the supplier's production die is known.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from packaging import manifest, _linework, _rounded_rectangle

VALID_TEMPLATES = {
    'board-roll-end', 'board-window-cake', 'board-self-locking-tuck',
    'board-tuck-end', 'corr-roll-end-wing', 'board-simple-tray',
}

FOOD_FAMILIES = {
    'fold-top-takeout': 'catalogue-fold-top-takeout',
    'burger-clamshell': 'catalogue-burger-clamshell',
    'gable-food-box': 'catalogue-gable-handle',
}


def food_manifest(family, dimensions):
    """Original connected-sheet studies of the photographed food-box families.

    The supplier's three nominal axes are retained. The photos identify the
    closure family, but cannot determine a production die's tab dimensions,
    wall taper, glue allowances or crease offsets. Those details remain
    explicit estimates rather than being borrowed from an unrelated mailer.
    """
    l, w, h = (dimensions[key] for key in ('L', 'W', 'H'))
    panels, turn = [], math.pi / 2

    def add(id, parent, width, height, hinge, center, axis, angle,
            phase, face=None, outline=None, **extra):
        item = dict(id=id, parent=parent, width=width, height=height,
                    hinge=[*hinge, 0], center=[*center, 0], axis=axis,
                    closed_angle=angle, phase=phase, face=face, shape='rect',
                    **extra)
        if outline is not None:
            item['outline_points'] = outline
        panels.append(item)
        return item

    def base_and_walls(body_height):
        add('base', None, l, w, (0, 0), (0, 0), 'x', 0, [0, 1], 'inside')
        add('front', 'base', l, body_height, (0, -w / 2),
            (0, -body_height / 2), 'x', -turn, [.60, .92], 'front')
        add('back', 'base', l, body_height, (0, w / 2),
            (0, body_height / 2), 'x', turn, [.60, .92], 'back')
        for side, sign in [('left', -1), ('right', 1)]:
            add(side, 'base', body_height, w, (sign * l / 2, 0),
                (sign * body_height / 2, 0), 'y', -sign * turn,
                [.65, .98], side)
            # Separate articulated corner glue tabs. Their diagonal scores
            # mark the estimated gusset fold, not a printed decoration.
            depth = min(body_height * .64, w * .23)
            for end, edge in [('front', -1), ('back', 1)]:
                flap = add(side + '-' + end + '-corner', side,
                           body_height, depth,
                           (sign * body_height / 2, edge * w / 2),
                           (0, edge * depth / 2), 'x', edge * turn,
                           [.42, .64], outline=[
                               [-body_height / 2, 0], [body_height / 2, 0],
                               [body_height * .37, edge * depth],
                               [-body_height * .37, edge * depth]])
                flap['scores'] = [[[-body_height / 2, 0],
                                   [body_height * .37, edge * depth]]]

    if family == 'fold-top-takeout':
        base_and_walls(h)
        depth = w * .57
        # Broad opposing top flaps with a central rounded locking tongue and
        # a corresponding cut slot, plus two tapered side dust flaps.
        for end, edge in [('front', -1), ('back', 1)]:
            outline = [[-l / 2, 0], [l / 2, 0],
                       [l * .46, edge * depth * .84],
                       [l * .32, edge * depth],
                       [-l * .32, edge * depth],
                       [-l * .46, edge * depth * .84]]
            flap = add('top-' + end, end, l, depth,
                       (0, edge * h), (0, edge * depth / 2), 'x',
                       edge * turn, [.04, .32], 'lid' if edge == -1 else None,
                       outline=outline,
                       fold_offset=[0, 0, .45 if edge == -1 else -.45])
            slot_y, slot_w = edge * depth * .68, l * .20
            if edge == 1:
                flap['holes'] = [_rounded_rectangle(
                    -slot_w / 2, slot_y - .6, slot_w / 2, slot_y + .6, .5, 3)]
            else:
                flap['slits'] = [[[-slot_w / 2, slot_y], [slot_w / 2, slot_y]]]
        for side, sign in [('left', -1), ('right', 1)]:
            depth = l * .48
            add('top-' + side, side, depth, w,
                (sign * h, 0), (sign * depth / 2, 0), 'y',
                -sign * turn, [.25, .48], outline=[
                    [0, -w / 2], [0, w / 2],
                    [sign * depth * .82, w * .39],
                    [sign * depth, w * .25],
                    [sign * depth, -w * .25],
                    [sign * depth * .82, -w * .39]])
        description = 'Four-flap takeout closure with separate corner gusset tabs and a tongue/slot fastening.'
        estimated = ['wallTaper', 'cornerGussetProfiles', 'lockingTongueAndSlot', 'creaseAllowances', 'boardThickness']
    elif family == 'burger-clamshell':
        # The photograph shows a shallow bottom tray and a deeper skirted lid,
        # not a tall mailer with one front tuck. The rear upper wall is a
        # separate panel connected at the shell seam and remains coplanar
        # with the lower rear wall in the assembled pose.
        bottom, hood = h * .55, h * .45
        base_and_walls(bottom)
        add('lid-back', 'back', l, hood, (0, bottom), (0, hood / 2),
            'x', 0, [.35, .65], 'back')
        add('lid', 'lid-back', l, w, (0, hood), (0, w / 2),
            'x', turn, [.10, .39], 'lid')
        front = add('lid-front', 'lid', l, hood, (0, w), (0, hood / 2),
                    'x', turn, [.01, .20], outline=[
                        [-l / 2, 0], [l / 2, 0], [l * .48, hood * .66],
                        [l * .37, hood], [-l * .37, hood],
                        [-l * .48, hood * .66]], fold_offset=[0, .7, 0])
        front['slits'] = [[[-l * .11, hood * .73], [l * .11, hood * .73]]]
        for side, sign in [('left', -1), ('right', 1)]:
            add('lid-' + side, 'lid', hood, w,
                (sign * l / 2, w / 2), (sign * hood / 2, 0), 'y',
                -sign * turn, [.13, .35], outline=[
                    [0, -w / 2], [0, w / 2],
                    [sign * hood, w / 2],
                    [sign * hood, w * .16],
                    [sign * hood * .90, 0],
                    [sign * hood, -w * .16],
                    [sign * hood, -w / 2]],
                fold_offset=[-sign * .7, 0, 0])
            depth = min(hood * .55, w * .17)
            for end, edge in [('front', 1), ('back', -1)]:
                add('lid-' + side + '-' + end + '-corner', 'lid-' + side,
                    hood, depth, (sign * hood / 2, edge * w / 2),
                    (0, edge * depth / 2), 'x', edge * turn,
                    [.25, .45], outline=[
                        [-hood / 2, 0], [hood / 2, 0],
                        [hood * .30, edge * depth],
                        [-hood * .30, edge * depth]])
            tab_width, tab_depth = min(l * .13, 18), min(hood * .28, 8)
            add('lid-lock-' + side, 'lid-front', tab_width, tab_depth,
                (sign * l * .25, hood), (0, tab_depth / 2), 'x',
                0, [0, .18], outline=[
                    [-tab_width / 2, 0], [tab_width / 2, 0],
                    [tab_width * .42, tab_depth * .8],
                    [tab_width * .23, tab_depth],
                    [-tab_width * .23, tab_depth],
                    [-tab_width * .42, tab_depth * .8]])
        description = 'Split-height burger clamshell with a shallow tray, skirted lid, corner tabs and two front locking ears.'
        estimated = ['baseLidHeightSplit', 'wallTaper', 'rearSeamMotion', 'cornerTabProfiles', 'lockingEars', 'creaseAllowances', 'boardThickness']
    elif family == 'gable-food-box':
        body, rise, handle_height = h * .70, h * .19, h * .11
        base_and_walls(body)
        slope = math.atan2(rise, w / 2)
        roof_depth = math.hypot(w / 2, rise)
        handle_width = l * .46
        for end, edge in [('front', -1), ('back', 1)]:
            add('roof-' + end, end, l, roof_depth,
                (0, edge * body), (0, edge * roof_depth / 2), 'x',
                edge * (turn - slope), [.12, .40],
                'lid' if edge == -1 else None)
            handle = add('handle-' + end, 'roof-' + end,
                         handle_width, handle_height,
                         (0, edge * roof_depth), (0, edge * handle_height / 2),
                         'x', -edge * (turn - slope), [.01, .18],
                         outline=[[-handle_width / 2, 0], [handle_width / 2, 0],
                                  [handle_width * .49, edge * handle_height * .65],
                                  [handle_width * .43, edge * handle_height],
                                  [-handle_width * .43, edge * handle_height],
                                  [-handle_width * .49, edge * handle_height * .65]],
                         fold_offset=[0, 0, .4 if edge == -1 else -.4])
            low, high = sorted((edge * handle_height * .26,
                                edge * handle_height * .77))
            handle['holes'] = [_rounded_rectangle(
                -handle_width * .35, low, handle_width * .35, high,
                handle_height * .20, 5)]
        for side, sign in [('left', -1), ('right', 1)]:
            add('gable-' + side, side, rise, w,
                (sign * body, 0), (sign * rise / 2, 0), 'y',
                0, [.30, .55], outline=[
                    [0, -w / 2], [0, w / 2], [sign * rise, 0]])
        description = 'Handled gable carton with two sloping roof halves, paired die-cut handholds, triangular end gables and four corner tabs.'
        estimated = ['bodyRoofHeightSplit', 'handleCutout', 'roofLockingDetails', 'cornerTabProfiles', 'creaseAllowances', 'boardThickness']
    else:
        raise ValueError('Unknown food-box family: ' + family)
    _linework(panels)
    return dict(schema_version='1.3', template_id=FOOD_FAMILIES[family],
                units='mm', dimensions=dimensions, panels=panels, upright=False,
                thickness_mm=.5, production_ready=False,
                structure_family=family, reference_kind='EcoPak product photographs',
                detail_dimensions_estimated=True,
                estimated_structural_parameters=estimated,
                description=description,
                line_colors={'cut': '#2523bc', 'crease': '#ef4144'},
                notice=description + ' Overall product dimensions are published by EcoPak. '
                       'Internal splits, taper, tabs, handholds and crease allowances are '
                       'estimated visual construction details. This connected fold study '
                       'is not a supplier-verified production dieline.')


def validate(model):
    seen = set()
    roots = 0
    for panel in model['panels']:
        assert panel['id'] not in seen, 'Duplicate panel'
        if panel['parent'] is None:
            roots += 1
        else:
            assert panel['parent'] in seen, 'Disconnected or unordered hinge'
        seen.add(panel['id'])
        for key in ('width', 'height'):
            assert math.isfinite(panel[key]) and panel[key] > 0
        for key in ('center', 'hinge', 'phase'):
            assert all(math.isfinite(n) for n in panel[key])
        assert math.isfinite(panel['closed_angle'])
        assert len(panel['outline']) >= 3
    assert roots == 1, 'Each fold graph must be one connected sheet'
    if model['template_id'].startswith('catalogue-'):
        # A rooted transform tree alone can hide floating flaps. Each new
        # food-family hinge must share an actual edge with its parent sheet.
        by_id = {panel['id']: panel for panel in model['panels']}

        def on_segment(point, a, b):
            cross = ((b[0] - a[0]) * (point[1] - a[1])
                     - (b[1] - a[1]) * (point[0] - a[0]))
            dot = ((point[0] - a[0]) * (point[0] - b[0])
                   + (point[1] - a[1]) * (point[1] - b[1]))
            return abs(cross) < 1e-4 and dot < 1e-5

        for panel in model['panels']:
            if panel['parent'] is None:
                continue
            perimeter = by_id[panel['parent']]['outline']
            dx, dy, _ = panel['hinge']
            points = [[x + dx, y + dy] for x, y in panel['crease']]
            points.append([(points[0][0] + points[1][0]) / 2,
                           (points[0][1] + points[1][1]) / 2])
            for point in points:
                assert any(on_segment(point, a, b)
                           for a, b in zip(perimeter, perimeter[1:] + perimeter[:1])), (
                               'Detached physical hinge: ' + panel['id'])


def build():
    catalogue = json.loads((ROOT / 'catalogue-mockups.json').read_text())
    source = json.loads((ROOT / 'shop-catalogue.json').read_text())
    models, products, skipped = {}, {}, []
    variant_count = 0
    for product in source:
        spec = catalogue['products'][product['id']]
        template = (spec.get('templateCandidate') or {}).get('localTemplateId')
        food_family = spec.get('family') if spec.get('family') in FOOD_FAMILIES else None
        if food_family:
            template = FOOD_FAMILIES[food_family]
        # A tray with a separate clear lid needs the procedural lid assembly;
        # its tray-only dieline must not replace the complete product preview.
        foldable = spec['geometryType'] == 'folding-box' or (
            spec['geometryType'] == 'food-tray' and not spec['features'].get('lid'))
        if not foldable or (template not in VALID_TEMPLATES and not food_family):
            if spec['geometryType'] == 'folding-box':
                skipped.append({'productId': product['id'], 'reason': 'No mapped local connected structure; product-shape preview retained.'})
            continue
        entries = {}
        for option in product['options']:
            variant_id = str(option['variantId'])
            variant = spec['variants'][variant_id]
            preview = {**spec['previewDimensionsMm'], **variant.get('previewDimensionsMm', {})}
            dimensions = {axis: preview[axis] for axis in ('L', 'W', 'H')}
            assert all(math.isfinite(n) and n > 0 for n in dimensions.values())
            signature = json.dumps([template, dimensions], sort_keys=True, separators=(',', ':'))
            key = template + '-' + hashlib.sha256(signature.encode()).hexdigest()[:12]
            if key not in models:
                model = food_manifest(food_family, dimensions) if food_family else manifest(template, dimensions)
                model['structure_status'] = 'candidate-unverified'
                model['dimension_policy'] = 'Published nominal dimensions retained; missing proportions explicitly estimated in catalogue-mockups.json.'
                model['production_ready'] = False
                validate(model)
                models[key] = model
            entries[variant_id] = key
            variant_count += 1
        default_option = product['options'][product.get('defaultOptionIndex', 0)]
        products[product['id']] = {
            'defaultModel': entries[str(default_option['variantId'])],
            'variants': entries,
            'structureStatus': 'candidate-unverified',
            'dimensionsStatus': spec['dimensionsStatus'],
            'referenceKey': spec['templateCandidate'].get('pacdoraReferenceKey'),
        }
    output = {
        'schemaVersion': 1,
        'notice': 'Original local visual fold studies. Candidate structure references do not establish an exact supplier production match. Small tabs, locks, windows and clearances remain illustrative.',
        'coverage': {'products': len(products), 'variants': variant_count, 'uniqueModels': len(models), 'unmappedFoldingProducts': len(skipped)},
        'models': models,
        'products': products,
        'unmappedProducts': skipped,
    }
    (ROOT / 'catalogue-models.json').write_text(json.dumps(output, separators=(',', ':')) + '\n')
    print(json.dumps(output['coverage'], indent=2))


if __name__ == '__main__':
    build()
