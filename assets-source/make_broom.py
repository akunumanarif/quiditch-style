"""Original procedural M0 broom proxy. Reproducible, no third-party mesh data."""
import json, math, struct
from pathlib import Path
vertices=[]; normals=[]; indices=[]
def cylinder(y,length,r1,r2,segments=16):
    base=len(vertices)//3
    for h,r in [(y,r1),(y+length,r2)]:
        for i in range(segments):
            a=i*math.tau/segments
            vertices.extend([math.cos(a)*r,h,math.sin(a)*r]);normals.extend([math.cos(a),0,math.sin(a)])
    for i in range(segments):
        j=(i+1)%segments
        indices.extend([base+i,base+j,base+segments+i,base+j,base+segments+j,base+segments+i])
cylinder(0,3.1,.045,.065)
cylinder(-.9,1.05,.3,.065,24)
for y in [-.1,0,.1,.2]:cylinder(y,.035,.085,.085)
for i in range(20):
    # Finer individual tapered bristle bundles.
    start=len(vertices)//3;cylinder(-1.15,.8,.032,.012,6)
    a=i*math.tau/20
    for v in range(start,len(vertices)//3):vertices[v*3]+=math.cos(a)*.22;vertices[v*3+2]+=math.sin(a)*.22
pos=struct.pack('<'+'f'*len(vertices),*vertices);nor=struct.pack('<'+'f'*len(normals),*normals);ind=struct.pack('<'+'I'*len(indices),*indices);binary=pos+nor+ind
mins=[min(vertices[i::3]) for i in range(3)];maxs=[max(vertices[i::3]) for i in range(3)]
gltf={'asset':{'version':'2.0','generator':'Broom League original M0 proxy generator'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':'Windmere broom proxy'}],'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1},'indices':2,'material':0}]}],'materials':[{'name':'Walnut PBR','pbrMetallicRoughness':{'baseColorFactor':[.22,.105,.045,1],'metallicFactor':.05,'roughnessFactor':.72},'doubleSided':True}],'buffers':[{'byteLength':len(binary)}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(pos),'target':34962},{'buffer':0,'byteOffset':len(pos),'byteLength':len(nor),'target':34962},{'buffer':0,'byteOffset':len(pos)+len(nor),'byteLength':len(ind),'target':34963}],'accessors':[{'bufferView':0,'componentType':5126,'count':len(vertices)//3,'type':'VEC3','min':mins,'max':maxs},{'bufferView':1,'componentType':5126,'count':len(normals)//3,'type':'VEC3'},{'bufferView':2,'componentType':5125,'count':len(indices),'type':'SCALAR'}]}
j=json.dumps(gltf,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary+=b'\x00'*((-len(binary))%4)
output=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
Path('apps/web/public/assets/broom-proxy.glb').write_bytes(output)
print(f'Original broom: {len(vertices)//3} vertices, {len(indices)//3} triangles, {len(output)} bytes')
