"""Generate an animated, skinned bot LOD from the original authored rider."""
import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/windmere-rider.blend'))
triangles=0
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    if len(obj.data.polygons)>250:
        modifier=obj.modifiers.new('Bot LOD decimation','DECIMATE')
        modifier.ratio=.22
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.calc_loop_triangles()
    triangles+=len(obj.data.loop_triangles)
    obj.select_set(False)
bpy.ops.export_scene.gltf(filepath=str(root/'apps/web/public/assets/windmere-rider-lod.glb'),export_format='GLB',export_animations=True,export_skins=True,export_nla_strips=True)
print('BOT LOD triangles:',triangles)
