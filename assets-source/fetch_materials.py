"""Vendor CC0 Poly Haven maps locally; API is preparation-only, never runtime."""
import json,subprocess,hashlib
from pathlib import Path
OUT=Path('apps/web/public/assets');META=Path('assets-source/vendor');META.mkdir(exist_ok=True)
def fetch(url,path):
    if path.exists() and path.stat().st_size>500:return
    subprocess.run(['rtk','proxy','curl','--fail','-L','--retry','2','-A','BroomLeagueDev/0.2','-sS',url,'-o',str(path)],check=True)
records=[]
for name in ['castle_brick_01','grass_ground','roof_slates_02','brown_leather','leafy_grass']:
    meta=META/(name+'.json');fetch('https://api.polyhaven.com/files/'+name,meta);data=json.loads(meta.read_text())
    for kind in ['diff','nor_gl','arm']:
        key=next((k for k in data if k.lower().startswith(kind)),None)
        if not key:raise RuntimeError(str(data.keys()))
        source=data[key]['1k']['jpg'];target=OUT/'materials'/(name+'_'+kind+'.jpg');fetch(source['url'],target)
        records.append({'id':name+'_'+kind,'path':str(target),'url':source['url'],'source':'https://polyhaven.com/a/'+name,'license':'CC0-1.0','bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
name='kloppenheim_06_puresky';meta=META/(name+'.json');fetch('https://api.polyhaven.com/files/'+name,meta);data=json.loads(meta.read_text());source=data['hdri']['1k']['hdr'];target=OUT/'environment'/'windmere-sky.hdr';fetch(source['url'],target);records.append({'id':name,'path':str(target),'url':source['url'],'source':'https://polyhaven.com/a/'+name,'license':'CC0-1.0','bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
fetch('https://polyhaven.com/license',META/'polyhaven-license.html')
Path('public-assets/vendor-manifest.json').write_text(json.dumps({'version':1,'credit':'Powered by Poly Haven','downloadedAt':'2026-11-12','assets':records},indent=2)+'\n')
print('Vendored',len(records),'assets,',sum(r['bytes'] for r in records),'bytes')
