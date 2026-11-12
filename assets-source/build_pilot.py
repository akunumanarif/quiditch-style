"""Original Windmere flight athlete + broom, authored with Blender. No vendor mesh."""
import bpy, math, random, os
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'apps/web/public/assets';random.seed(41)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def material(name,color,rough=.7,metal=0,leather=False):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if leather:
        nodes=m.node_tree.nodes;links=m.node_tree.links;uv=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=2;links.new(uv.outputs['UV'],mapping.inputs[0])
        tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(OUT/'materials/brown_leather_diff.jpg'));links.new(mapping.outputs[0],tex.inputs[0]);links.new(tex.outputs['Color'],p.inputs['Base Color'])
    return m
fabric=material('TeamFabric',(.075,.15,.14),.94);seam=material('Ochre embroidered piping',(.52,.36,.12),.7);leather=material('Weathered leather',(.17,.075,.026),.72,leather=True);boot=material('Boot leather',(.035,.026,.019),.62);brass=material('Aged brass',(.48,.31,.12),.38,.76);skin=material('Skin',(.43,.26,.16),.75);hair=material('Dark hair',(.035,.023,.015),.9);glass=material('Smoked goggles',(.06,.11,.11),.12,.45);wood=material('Walnut broom',(.15,.058,.019),.54);straw=material('Willow twigs',(.21,.12,.047),.92)
objects=[]
def finish(o,name,m,bone=None):
    o.name=name;o.data.materials.append(m)
    for f in o.data.polygons:f.use_smooth=True
    if bone:o['bone']=bone
    objects.append(o);return o

def ellipsoid(name,center,scale,m,bone=None,segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=12,location=center);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m,bone)
def tube(name,points,radii,m,bone=None,segments=16,elliptic=1):
    vertices=[];faces=[]
    for j,(point,r) in enumerate(zip(points,radii)):
        p=Vector(point);d=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)]);d.normalize();t=d.cross(Vector((0,0,1)))
        if t.length<.1:t=d.cross(Vector((0,1,0)))
        t.normalize();b=d.cross(t).normalized()
        for i in range(segments):
            a=i*math.tau/segments;v=p+t*(math.cos(a)*r)+b*(math.sin(a)*r*elliptic);vertices.append(v)
    for j in range(len(points)-1):
        for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
    faces.extend([tuple(reversed(tuple(range(segments)))),tuple((len(points)-1)*segments+i for i in range(segments))])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();uv=mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            vi=mesh.loops[li].vertex_index;uv.data[li].uv=(vi%segments/segments,vi//segments/max(1,len(points)-1))
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);return finish(o,name,m,bone)

def torus(name,center,major,minor,m,rotation=(0,0,0),bone=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=24,minor_segments=8,location=center,rotation=rotation);return finish(bpy.context.object,name,m,bone)
# Blender Z up, Y forward. Rider seated at 1.4m above broom, knees bent forward.
tube('Tailored riding coat',[(0,-.08,.33),(0,-.1,.48),(0,-.02,.72),(0,.1,.99),(0,.16,1.14)], [.23,.245,.25,.31,.26],fabric,'chest',24,.73)
ellipsoid('Neck',(0,.21,1.23),(.105,.1,.16),skin,'head')
ellipsoid('Head',(0,.25,1.43),(.145,.14,.205),skin,'head',32)
ellipsoid('Leather flight helmet',(0,.22,1.51),(.157,.146,.164),leather,'head',32)
# Lower helmet edge, ear cups, goggles and straps define a human silhouette.
for side in [-1,1]:
    ellipsoid('Ear cover',(side*.15,.23,1.42),(.027,.07,.085),leather,'head')
    ellipsoid('Goggle lens',(side*.069,.373,1.48),(.057,.018,.043),glass,'head')
    ring=torus('Goggle brass rim',(side*.069,.381,1.48),.049,.007,brass,(math.pi/2,0,0),'head');ring.scale.x=1.12;ring.scale.y=.8
    tube('Helmet seam',[(side*.07,.12,1.635),(side*.08,.24,1.66),(side*.08,.34,1.59)],[.006]*3,seam,'head',8)
ellipsoid('Nose',(0,.39,1.415),(.029,.029,.048),skin,'head')
tube('Goggle bridge',[(-.025,.388,1.48),(.025,.388,1.48)],[.008,.008],brass,'head',8)
# Fitted trousers, articulated joints and shaped boots.
for side,suffix in [(-1,'L'),(1,'R')]:
    hip=(side*.17,-.05,.4);knee=(side*.29,.44,.05);ankle=(side*.31,.12,-.46);hand=(side*.17,.72,.55);shoulder=(side*.26,.13,1.05);elbow=(side*.34,.43,.78)
    tube('Riding breeches '+suffix,[hip,(side*.24,.22,.24),knee],[.14,.145,.105],fabric,'thigh.'+suffix,20,.9)
    tube('Tall riding boot '+suffix,[knee,(side*.31,.26,-.19),ankle],[.11,.105,.075],boot,'shin.'+suffix,20,.9)
    ellipsoid('Boot toe '+suffix,(side*.31,.23,-.49),(.09,.19,.07),boot,'shin.'+suffix)
    for h in [.08,-.12,-.28]:torus('Boot buckle '+suffix,(side*.31,.27,h),.103,.008,brass,bone='shin.'+suffix)
    tube('Upper sleeve '+suffix,[shoulder,(side*.33,.26,.95),elbow],[.13,.118,.105],fabric,'upperarm.'+suffix,20)
    tube('Forearm guard '+suffix,[elbow,(side*.25,.61,.62),hand],[.103,.09,.07],leather,'forearm.'+suffix,20)
    ellipsoid('Gloved palm '+suffix,hand,(.08,.1,.06),leather,'forearm.'+suffix)
    for f in range(4):
        x=side*.17+(f-1.5)*.027;tube('Curled glove finger',[(x,.76,.57),(x,.79,.52),(x,.75,.48)],[.018,.017,.013],leather,'forearm.'+suffix,8)
    tube('Coat front piping '+suffix,[(side*.15,.13,.43),(side*.17,.22,.7),(side*.18,.29,.95),(side*.12,.25,1.12)],[.008]*4,seam,'chest',8)
    tube('Shoulder leather pad '+suffix,[(side*.21,.11,1.13),(side*.33,.17,1.03)],[.14,.12],leather,'upperarm.'+suffix,20,.45)
for z in [.55,.69,.83,.97]:ellipsoid('Brass coat fastener',(0,.205+(z-.55)*.13,z),(.019,.012,.019),brass,'chest',12)
torus('Belt around waist',(0,-.04,.48),.25,.026,leather,bone='chest').scale.y=.78
ellipsoid('Belt crest',(0,.17,.48),(.057,.018,.045),brass,'chest')
# Cloth cape, physically shaped rather than a rigid box. A dedicated bone animates it.
verts=[];faces=[]
for row in range(12):
    t=row/11
    for col in range(15):
        u=col/14*2-1;verts.append((u*(.23+.1*t),.04-.7*t-.06*math.cos(u*math.pi*3)*t,1.1-.79*t+.018*math.cos(u*math.pi*4)*t))
for row in range(11):
    for col in range(14):a=row*15+col;faces.append((a,a+1,a+16,a+15))
mesh=bpy.data.meshes.new('Flight cape cloth');mesh.from_pydata(verts,[],faces);mesh.update();cape=bpy.data.objects.new('Short flight cape',mesh);bpy.context.collection.objects.link(cape);finish(cape,'Short flight cape',fabric,'cape');sol=cape.modifiers.new('Cloth thickness','SOLIDIFY');sol.thickness=.006
# Swept wooden handle, leather grips, metal fittings and individual willow twigs.
tube('Swept walnut shaft',[(0,-1.12,-.05),(0,-.35,.02),(0,.3,.32),(0,.8,.54),(0,1.35,.56),(0,1.65,.68)],[.045,.05,.047,.035,.028,.02],wood,'root',20)
for y in [.54,.58,.62,.66,.7,.74,.78,.82]:torus('Handle leather binding',(0,y,.54),.038,.009,leather,(math.pi/2,0,0),'root')
for y in [-.72,-.56]:torus('Brass brush collar',(0,y,-.025),.09,.014,brass,(math.pi/2,0,0),'root')
for n in range(100):
    a=n*2.399;r=.045+random.random()*.04;spread=.1+random.random()*.17;end=-1.65-random.random()*.45
    tube('Willow branch',[(math.cos(a)*r,-.65,math.sin(a)*r-.02),(math.cos(a)*spread,-1.25,math.sin(a)*spread-.07),(math.cos(a)*spread*.6,end,math.sin(a)*spread*.6-.13)],[.009,.008,.002],straw,'root',5)
# Armature with independent body, limbs, head and cape bones.
arm=bpy.data.armatures.new('Windmere rider skeleton');rig=bpy.data.objects.new('Windmere_Rider_Rig',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
bones={'root':((0,0,0),(0,0,.3),None),'chest':((0,-.05,.4),(0,.16,1.14),'root'),'head':((0,.18,1.15),(0,.25,1.62),'chest'),'cape':((0,.04,1.1),(0,-.65,.31),'chest')}
for side,suf in [(-1,'L'),(1,'R')]:
    bones['thigh.'+suf]=((side*.17,-.05,.4),(side*.29,.44,.05),'root');bones['shin.'+suf]=((side*.29,.44,.05),(side*.31,.12,-.46),'thigh.'+suf);bones['upperarm.'+suf]=((side*.26,.13,1.05),(side*.34,.43,.78),'chest');bones['forearm.'+suf]=((side*.34,.43,.78),(side*.17,.72,.55),'upperarm.'+suf)
for name,(head,tail,parent) in bones.items():
    b=arm.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for o in objects:
    bone=o.get('bone','root');group=o.vertex_groups.new(name=bone);group.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Flight rig','ARMATURE');mod.object=rig;o.parent=rig
# Merge by material while preserving named bone weight groups (bounded draw calls).
for o in list(objects):
    for mod in list(o.modifiers):
        if mod.type=='SOLIDIFY':
            bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
for m in [fabric,seam,leather,boot,brass,skin,hair,glass,wood,straw]:
    group=[o for o in list(bpy.data.objects) if o.type=="MESH" and o.data.materials[0]==m]
    if not group:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name=m.name+' mesh'
# Export looped skeletal animations, one NLA track per named state.
for name,lean,sway in [('Flight',0,.018),('Boost',.18,.008),('Brake',-.12,.025),('Ascend',.1,.02),('Descend',-.08,.018),('BankLeft',0,.05),('BankRight',0,-.05),('Recover',-.06,.07)]:
    rig.animation_data_create();action=bpy.data.actions.new(name);rig.animation_data.action=action
    for f in [1,16,31,46,61]:
        phase=(f-1)/60*math.tau
        for bone in rig.pose.bones:bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0)
        rig.pose.bones['chest'].rotation_euler.x=lean+math.sin(phase)*.012
        rig.pose.bones['head'].rotation_euler.y=math.sin(phase)*sway*.5
        rig.pose.bones['cape'].rotation_euler.x=.08+lean*.3+math.sin(phase*2)*.065
        rig.pose.bones['cape'].rotation_euler.z=math.sin(phase)*.035
        for bn in ['chest','head','cape']:rig.pose.bones[bn].keyframe_insert(data_path='rotation_euler',frame=f)
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action)
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
for b in rig.pose.bones:b.rotation_euler=(0,0,0)
bpy.context.scene.frame_set(1);bpy.context.scene.render.fps=30
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/windmere-rider.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'windmere-rider.glb'),export_format='GLB',export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_apply=False,export_materials='EXPORT',export_image_format='JPEG',export_image_quality=82,export_skins=True,export_cameras=False,export_lights=False)
print('EXPORTED',OUT/'windmere-rider.glb', 'bytes', (OUT/'windmere-rider.glb').stat().st_size,'objects',len(objects),'animations',len(rig.animation_data.nla_tracks))
