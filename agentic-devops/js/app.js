/* LAST STOP — ALL SIX SHOTS
 * All scenery is built from geometry. No images, fonts, models or audio are fetched.
 * EDIT HERE: the duration, camera path, lamp strength and robot movement are below.
 * Animation is a function of elapsed seconds, so pause, seek and restart agree.
 */
(() => {
  'use strict';
  const STORY = typeof LastStopStory==='undefined'?null:LastStopStory;
  const DURATION = STORY?STORY.duration:45;
  const FPS = 24;
  const ASPECT = 2.39;
  const el = Object.fromEntries(['film','frame','player','play','pause','restart','fullscreen','seek','timecode','state','sound','loading','error','shot-label','shot-heading','shot-note','camera-note','ending'].map(id => [id, document.getElementById(id)]));
  let renderer, scene, camera, elapsed = 0, playing = false, lastTick = 0, animationId = 0;
  let robot, head, chestLight, lamp, glow, dust, dustOrigins, torso, ticket, limbs, bus, busDoors, busWheels, roadDust, roadDustOrigins;
  let audioContext, audioGain, soundtrack, soundRequest=0, audioSources = [], currentShot=-1;
  const shotButtons = Array.from(document.querySelectorAll('[data-shot]'));
  let randomSeed = 73426;
  const random = () => { randomSeed = (1664525 * randomSeed + 1013904223) >>> 0; return randomSeed / 4294967296; };
  const lerp = (a,b,t) => a + (b-a)*t;
  const smooth = t => t*t*(3-2*t);
  const mat = (color, extras={}) => new THREE.MeshStandardMaterial({color,roughness:0.85,...extras});

  function mesh(geometry, material, x=0,y=0,z=0, parent=scene) {
    const m = new THREE.Mesh(geometry,material);
    m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const box = (w,h,d,m,x,y,z,p) => mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,p);
  function rod(a,b,r,material,parent=scene,sides=8) {
    const direction = new THREE.Vector3().subVectors(b,a);
    const m = mesh(new THREE.CylinderGeometry(r,r,direction.length(),sides),material,0,0,0,parent);
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return m;
  }
  function rounded(w,h,d,material,x,y,z,parent,r=.055) {
    r=Math.min(r,w/3,h/3,d*.45);
    const shape = new THREE.Shape();
    const a=-w/2+r,b=-h/2+r,c=w/2-r,e=h/2-r;
    shape.moveTo(a,b);shape.lineTo(c,b);shape.lineTo(c,e);shape.lineTo(a,e);shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:r,bevelThickness:r,curveSegments:2});
    g.translate(0,0,-d/2+r);return mesh(g,material,x,y,z,parent);
  }
  function canvasTexture(draw,w=512,h=512) {
    const c=document.createElement('canvas');c.width=w;c.height=h;
    draw(c.getContext('2d'),w,h);
    const t = new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
  }
  const radial = () => canvasTexture((ctx,w,h)=>{
    const g=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
    g.addColorStop(0,'rgba(255,231,178,.85)');g.addColorStop(.12,'rgba(255,200,115,.35)');g.addColorStop(.40,'rgba(251,170,70,.07)');g.addColorStop(1,'rgba(230,135,50,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  },128,128);

  function makeWorld() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x182c36,.011);
    camera = new THREE.PerspectiveCamera(36,ASPECT,.035,420);
    renderer = new THREE.WebGLRenderer({canvas:el.film,antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.75));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;

    const sky = mesh(new THREE.SphereGeometry(350,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{},vertexShader:'varying vec3 vPosition; void main(){ vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',fragmentShader:'varying vec3 vPosition; void main(){float h=normalize(vPosition).y; vec3 horizon=vec3(.045,.094,.12); vec3 zenith=vec3(.009,.025,.048); vec3 c=mix(horizon,zenith,smoothstep(-.03,.55,h)); gl_FragColor=vec4(c,1.);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n }'}));
    sky.castShadow=false;sky.receiveShadow=false;
    const stars=[];const starColors=[];
    for(let i=0;i<650;i++) {
      const angle=random()*Math.PI*2;
      const x=Math.cos(angle)*230,y=10+random()*170,z=Math.sin(angle)*230;
      stars.push(x,y,z);const v=.35+random()*.55;starColors.push(v*.8,v*.9,v);
    }
    const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));starGeo.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));
    scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({size:.20,vertexColors:true,transparent:true,opacity:.8,fog:false,depthWrite:false})));
    const moon=mesh(new THREE.SphereGeometry(2,24,16),new THREE.MeshBasicMaterial({color:0xcbd8c8,fog:false}),-36,18,-95);
    moon.castShadow=false;moon.receiveShadow=false;
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:radial(),color:0x8ba9bf,transparent:true,opacity:.10,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
    halo.position.copy(moon.position);halo.scale.set(14,14,1);scene.add(halo);
    scene.add(new THREE.HemisphereLight(0x829ead,0x3f2920,.42));
    const moonlight=new THREE.DirectionalLight(0x87acc7,.75);moonlight.position.set(-30,35,-20);scene.add(moonlight);

    const sand=mat(0x8e7154);
    const groundGeo=new THREE.PlaneGeometry(350,350,105,105);groundGeo.rotateX(-Math.PI/2);
    const pos=groundGeo.attributes.position;
    const colors=[];
    for(let i=0;i<pos.count;i++) {
      const x=pos.getX(i),z=pos.getZ(i);
      const nearRoad=Math.min(1,Math.max(0,(Math.abs(x+5)-4.3)/12));
      const clearStop=1-Math.exp(-((x-3)**2+(z+1)**2)/95);
      const height=(Math.sin(x*.11+z*.06)*.65+Math.cos(z*.13-x*.07)*.45+.5)*nearRoad*clearStop;
      pos.setY(i,height-.12);
      const tone=.81+random()*.15;colors.push(tone,tone*.94,tone*.84);
    }
    groundGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));groundGeo.computeVertexNormals();
    sand.vertexColors=true;mesh(groundGeo,sand).castShadow=false;

    // A road receding toward the left of frame makes the empty distance visible.
    const asphalt=mat(0x20292b);box(5.4,.045,340,asphalt,-5,-.015,0).castShadow=false;
    const roadEdge=mat(0xc4ad7e);box(.065,.052,338,roadEdge,-7.54,.008,0).castShadow=false;
    box(.065,.052,338,roadEdge,-2.46,.008,0).castShadow=false;
    const stripe=mat(0xc0a16b);
    for(let z=162;z>-166;z-=7){box(.075,.054,2.8,stripe,-5.07,.009,z).castShadow=false;box(.075,.054,2.8,stripe,-4.87,.009,z).castShadow=false;}
    const slab=mat(0x817566);box(6.5,.14,3.5,slab,3.5,.04,.0);

    // Angular mesas: plain geometry, silhouettes, and atmospheric perspective.
    const mountain=mat(0x33454a);
    for(let i=0;i<18;i++){
      const x=-120+i*14+random()*9,z=-90-random()*70;
      const h=5+random()*14,rad=10+random()*15;
      const m=mesh(new THREE.CylinderGeometry(rad*.38,rad,h,5,1),mountain,x,h*.43,z);m.rotation.y=random()*6;m.castShadow=false;
    }
    const rockMat=mat(0x736654);
    for(let i=0;i<105;i++){
      const x=(random()-.5)*85,z=(random()-.5)*85;
      if((x>-8&&x<-2)||(x>-.5&&x<8&&z>-4&&z<4))continue;
      const s=.07+random()*.22;const m=mesh(new THREE.DodecahedronGeometry(s,0),rockMat,x,s*.25,z);m.scale.set(1.5,.6,1);m.rotation.set(random(),random()*6,random());
    }
    makeCactus(-13,-1,2.0);makeCactus(13,-6,2.4);makeCactus(-14,-24,1.6);makeCactus(19,-33,2.5);makeCactus(-23,-44,3);
    // Two foreground grass clumps add parallax without hiding the traveler.
    makeGrass(8,9,.9);makeGrass(-1,10,.55);makeGrass(11,-4,.55);makeGrass(-10,-11,.7);
    const timber=mat(0x514b3d);
    for(let i=0;i<5;i++){
      const z=-15-i*18,x=8+i*.25;
      box(.16,5.4,.17,timber,x,2.6,z);box(1.6,.10,.12,timber,x,4.7,z);
      if(i<4){const pts=[];for(let j=0;j<=12;j++){const t=j/12;pts.push(new THREE.Vector3(x+.65+t*.25,4.75-Math.sin(t*Math.PI)*.65,z-t*18));}
      const curve=new THREE.CatmullRomCurve3(pts);mesh(new THREE.TubeGeometry(curve,20,.017,3,false),mat(0x242e2d));}
    }
    makeShelter();makeRobot();makeBus();makeDust();
  }
  function makeCactus(x,z,h){
    const p=new THREE.Group();p.position.set(x,0,z);scene.add(p);
    const m=mat(0x354e46);mesh(new THREE.CylinderGeometry(.13,.18,h,7),m,0,h/2,0,p);
    for(const side of [-1,1]){
      const y=h*(side===1?.53:.68),end=.45*side;
      rod(new THREE.Vector3(0,y,0),new THREE.Vector3(end,y+.02,0),.09,m,p,6);
      rod(new THREE.Vector3(end,y,0),new THREE.Vector3(end,y+h*.27,0),.095,m,p,6);
    }
  }
  function makeGrass(x,z,h){
    const m=mat(0x766746);
    for(let i=0;i<8;i++){const theta=random()*Math.PI*2;
      rod(new THREE.Vector3(x,0,z),new THREE.Vector3(x+Math.cos(theta)*h*.45,h*(.4+random()*.6),z+Math.sin(theta)*h*.45),.016,m);}
  }
  function makeShelter(){
    const metal=mat(0x526765,{metalness:.5,roughness:.65});
    const wood=mat(0x785943);const roof=mat(0x815840,{metalness:.25});const rusty=mat(0x65584b,{metalness:.3});
    for(const x of [1,6]) for(const z of [-1.2,1.2]){
      box(.12,3.55,.12,metal,x,1.88,z);box(.26,.09,.24,rusty,x,.18,z);
    }
    box(5.35,.15,2.95,roof,3.5,3.61,0);
    for(let i=0;i<23;i++)box(.08,.07,2.95,roof,.9+i*.236,3.72,0);
    box(5.35,.23,.09,metal,3.5,3.49,1.47);
    box(5.35,.18,.09,metal,3.5,3.52,-1.47);
    // A partial timber back lets moonlight outline the figure.
    for(let i=0;i<7;i++)box(.64,1.15,.085,wood,1.38+i*.70,1.14,-1.19);
    box(4.72,.08,.10,metal,3.5,.6,-1.20);box(4.72,.08,.10,metal,3.5,1.72,-1.20);
    for(const z of [.11,.31,.51])box(3.70,.085,.16,wood,3.50,.89,z);
    for(const y of [1.17,1.40])box(3.70,.16,.065,wood,3.50,y,-.08);
    for(const x of [2,5]){box(.09,.76,.10,metal,x,.5,.28);box(.09,.90,.10,metal,x,1.05,-.13);}
    // Small route placard on the shelter fascia.
    const title=canvasTexture((ctx,w,h)=>{ctx.fillStyle='#435752';ctx.fillRect(0,0,w,h);ctx.fillStyle='#e8d7b3';ctx.font='500 40px Arial';ctx.textAlign='center';ctx.fillText('N I G H T   L I N E',w/2,58);},768,96);
    mesh(new THREE.PlaneGeometry(2.35,.29),new THREE.MeshBasicMaterial({map:title}),3.5,3.49,1.522);
    // The practical lamp is the key light and the brightest point in frame.
    const fixture=mat(0x30413e,{metalness:.6});
    box(.055,.25,.055,fixture,3.5,3.39,0);
    mesh(new THREE.CylinderGeometry(.08,.31,.18,16,1,true),fixture,3.5,3.20,0);
    mesh(new THREE.SphereGeometry(.095,12,8),new THREE.MeshBasicMaterial({color:0xffd398}),3.5,3.08,0);
    lamp=new THREE.PointLight(0xffc37e,47,18,2);lamp.position.set(3.5,3.04,.2);lamp.castShadow=true;lamp.shadow.mapSize.set(1024,1024);lamp.shadow.bias=-.0005;lamp.shadow.normalBias=.02;lamp.shadow.camera.near=.1;lamp.shadow.camera.far=20;scene.add(lamp);
    glow=new THREE.Sprite(new THREE.SpriteMaterial({map:radial(),transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending}));glow.position.set(3.5,3.08,.06);glow.scale.set(1.45,1.45,1);scene.add(glow);
    // A warm bounce gives the face a readable shape beneath the top light.
    const bounce=new THREE.PointLight(0xfeb878,4,5,2);bounce.position.set(2.3,1.3,2.6);scene.add(bounce);
    box(.055,3.7,.055,rusty,-.05,1.86,.18);
    const signTexture=canvasTexture((ctx,w,h)=>{
      ctx.fillStyle='#c9b58b';ctx.fillRect(0,0,w,h);ctx.fillStyle='#344b49';ctx.fillRect(12,12,w-24,h-24);
      ctx.fillStyle='#edddba';ctx.textAlign='center';ctx.font='bold 31px Arial';ctx.fillText('STOP',w/2,58);ctx.font='bold 103px Georgia';ctx.fillText('07',w/2,162);
      ctx.fillRect(43,185,170,3);ctx.font='18px Arial';ctx.fillText('NIGHT LINE',w/2,220);
    },256,256);
    const sign=box(.72,.82,.08,metal,-.05,3.38,.18);sign.rotation.y=.10;
    const front=mesh(new THREE.PlaneGeometry(.69,.79),new THREE.MeshStandardMaterial({map:signTexture,roughness:.9}),-.044,3.38,.229);front.rotation.y=.1;
    // A small abandoned case makes the wait feel lived in.
    const suitcase=rounded(.50,.35,.30,mat(0x947048),4.65,1.1,.37,scene,.04);
    box(.12,.06,.07,rusty,4.65,1.30,.37);box(.04,.34,.315,mat(0x4e4032),4.49,1.10,.37);
  }
  function makeRobot(){
    robot=new THREE.Group();robot.position.set(2.87,.10,.45);robot.rotation.y=-.24;scene.add(robot);
    robot.name='Traveler';torso=new THREE.Group();robot.add(torso);
    const shell=mat(0xc0b49a,{metalness:.32,roughness:.5});const trim=mat(0x4b6260,{metalness:.6,roughness:.45});const joints=mat(0x343d3e,{metalness:.7});
    rounded(.66,.65,.46,shell,0,1.29,0,torso,.07);
    rounded(.45,.25,.025,trim,0,1.29,.25,torso,.025);
    for(let i=0;i<3;i++)box(.19,.019,.012,joints,0,1.35-i*.047,.27,torso);
    chestLight=mesh(new THREE.SphereGeometry(.027,8,6),new THREE.MeshBasicMaterial({color:0xffc976}),.17,1.22,.273,torso);
    mesh(new THREE.CylinderGeometry(.095,.095,.15,12),joints,0,1.69,0,torso);
    head=new THREE.Group();head.position.set(0,1.94,.04);torso.add(head);
    rounded(.80,.57,.56,shell,0,0,0,head,.075);
    rounded(.64,.29,.06,mat(0x172b30,{metalness:.25,roughness:.35}),0,.015,.292,head,.035);
    const eyeMat=new THREE.MeshBasicMaterial({color:0xffd39b});
    head.userData.eyes=[rounded(.075,.11,.012,eyeMat,-.16,.015,.329,head,.006),rounded(.075,.11,.012,eyeMat,.16,.015,.329,head,.006)];
    limbs=[];
    for(const side of [-1,1]){
      const ear=mesh(new THREE.CylinderGeometry(.095,.095,.08,12),trim,side*.435,0,0,head);ear.rotation.z=Math.PI/2;
      const segment=(r,m)=>mesh(new THREE.CylinderGeometry(r,r,1,10),m,0,0,0,robot);
      const hand=rounded(.17,.14,.19,shell,0,0,0,robot,.028);
      const thumb=rounded(.045,.09,.075,shell,-side*.084,.025,.044,hand,.012);
      limbs.push({side,upperArm:segment(.085,shell),forearm:segment(.075,shell),shoulder:mesh(new THREE.SphereGeometry(.1,10,8),joints,0,0,0,robot),elbow:mesh(new THREE.SphereGeometry(.087,10,8),joints,0,0,0,robot),hand,thumb,thigh:segment(.11,trim),shin:segment(.091,shell),knee:mesh(new THREE.SphereGeometry(.116,10,8),joints,0,0,0,robot),boot:rounded(.24,.16,.39,trim,0,0,0,robot,.035)});
    }
    rod(new THREE.Vector3(.22,.26,0),new THREE.Vector3(.24,.44,0),.019,trim,head);
    mesh(new THREE.SphereGeometry(.035,8,6),mat(0xc89c61),.24,.46,0,head);
    ticket=new THREE.Group();ticket.name='One-way ticket';robot.add(ticket);
    const ticketTexture=canvasTexture((ctx,w,h)=>{
      ctx.fillStyle='#decaa1';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#956d49';ctx.lineWidth=4;ctx.strokeRect(16,16,w-32,h-32);
      ctx.fillStyle='#354b48';ctx.font='bold 22px Arial';ctx.textAlign='left';ctx.fillText('NIGHT LINE',32,50);ctx.font='bold 48px Georgia';ctx.fillText('ONE WAY',32,112);
      ctx.font='19px monospace';ctx.fillText('A PLACE TO GO',32,154);ctx.fillStyle='#a0744b';ctx.font='bold 68px Georgia';ctx.fillText('07',335,120);
      ctx.strokeStyle='#ac926b';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(318,25);ctx.lineTo(318,198);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#6c6453';for(let i=0;i<35;i++)ctx.fillRect(34+i*6,178,2+(i%3),25);
      ctx.strokeStyle='#b4a084';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(209,8);ctx.lineTo(220,216);ctx.stroke();
    },480,225);
    const paperGeometry=new THREE.PlaneGeometry(.35,.225,6,2),p=paperGeometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,.012*Math.sin((p.getX(i)+.175)/.35*Math.PI));
    paperGeometry.computeVertexNormals();
    const paper=mesh(paperGeometry,new THREE.MeshStandardMaterial({map:ticketTexture,roughness:1,side:THREE.DoubleSide}),0,.008,0,ticket);paper.rotation.x=-Math.PI/2;
  }
  function connect(segment,a,b){
    const direction=new THREE.Vector3().subVectors(b,a);
    segment.position.copy(a).add(b).multiplyScalar(.5);segment.scale.y=direction.length();
    segment.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  }
  function poseRobot(state,t){
    const s=state.stand,w=state.walk,step=t*8.4,bob=w*.019*Math.abs(Math.sin(step));
    robot.position.set(...state.position);robot.rotation.y=state.yaw;
    torso.position.y=.22*s+bob;torso.rotation.x=-.04*Math.sin(Math.PI*s);
    for(const leg of limbs){
      const side=leg.side,sw=Math.sin(step+(side<0?Math.PI:0))*w;
      const shoulder=new THREE.Vector3(side*.39,1.47+.22*s+bob,0);
      const elbow=new THREE.Vector3(side*lerp(.47,.43,s),lerp(1.13,1.26,s)+bob,lerp(.25,.025,s)-sw*.065);
      const wrist=new THREE.Vector3(side*lerp(.22,.40,s),lerp(1.01,.99,s)+bob,lerp(.55,side<0?.25:.02,s)-sw*(side<0?.035:.12));
      leg.shoulder.position.copy(shoulder);leg.elbow.position.copy(elbow);leg.hand.position.copy(wrist);
      connect(leg.upperArm,shoulder,elbow);connect(leg.forearm,elbow,wrist);
      leg.hand.rotation.set(.06*s,0,side*.05*s);
      const rub=(t>=5&&t<=12)?Math.sin((t-5)*2.7)*.022:0;
      leg.thumb.position.z=.044+rub;leg.thumb.rotation.x=side*rub*7;
      const hip=new THREE.Vector3(side*.20,.94+.22*s+bob,lerp(.08,0,s));
      const knee=new THREE.Vector3(side*.20,lerp(.71,.65,s)+Math.max(sw,0)*.045,lerp(.59,.10,s)+sw*.17);
      const ankle=new THREE.Vector3(side*.20,lerp(.19,.13,s)+Math.max(sw,0)*.12,lerp(.72,.035,s)+sw*.29);
      connect(leg.thigh,hip,knee);connect(leg.shin,knee,ankle);leg.knee.position.copy(knee);leg.boot.position.copy(ankle);leg.boot.position.z+=.085;leg.boot.rotation.x=-sw*.15;
    }
    ticket.position.set(lerp(0,-.40,s),lerp(1.055,1.08,s)+bob,lerp(.60,.24,s));
    ticket.rotation.set(s*.4,0,-.08+Math.sin(t*2.7)*((t>=5&&t<=12)?.025:.004));
    head.rotation.x=t<12?.12+.014*Math.sin(t*.8):lerp(.12,-.055,STORY.smooth(STORY.phase(t,13,18)));
    head.rotation.y=t<5?-.2-.32*STORY.smooth(STORY.phase(t,1.15,3.95)):state.look*(1-STORY.smooth(STORY.phase(t,20,26)));
    head.rotation.z=.07*(1-STORY.smooth(STORY.phase(t,13,18)))+.008*Math.sin(t*.6);
    const blink=1-.93*Math.max(...[8.7,18.5,32.1].map(at=>Math.exp(-(((t-at)/.10)**2))));
    for(const eye of head.userData.eyes)eye.scale.y=blink;
  }
  function makeBus(){
    bus=new THREE.Group();bus.name='Night Line bus';bus.visible=false;scene.add(bus);
    const green=mat(0x365854,{metalness:.3,roughness:.62}),cream=mat(0xbda987,{metalness:.2}),dark=mat(0x283737),rubber=mat(0x131d20),chrome=mat(0x899797,{metalness:.75,roughness:.35});
    const interior=mat(0xb19368),seat=mat(0x536b5e),glass=new THREE.MeshStandardMaterial({color:0xd3c3a0,emissive:0x98754d,emissiveIntensity:.25,transparent:true,opacity:.16,roughness:.25,side:THREE.DoubleSide,depthWrite:false});
    box(2.58,.18,6.95,dark,0,.40,0,bus);box(2.49,.055,6.76,interior,0,.52,0,bus);
    box(.11,1.10,6.90,green,-1.29,1.05,0,bus);
    box(.11,1.10,4.38,green,1.29,1.05,-1.21,bus);box(.11,1.10,.78,green,1.29,1.05,3.03,bus);
    rounded(2.68,.22,7.06,cream,0,3.21,0,bus,.09);
    for(const side of [-1,1]){
      box(.12,.16,6.95,cream,side*1.29,2.94,0,bus);
      for(const z of [-3.28,-2.04,-.76,.51,2.64,3.28])box(.12,1.32,.09,cream,side*1.29,2.22,z,bus);
      for(const z of [-2.66,-1.40,-.12]){const pane=mesh(new THREE.PlaneGeometry(1.12,1.15),glass,side*1.302,2.21,z,bus);pane.rotation.y=side*Math.PI/2;pane.castShadow=false;}
      if(side<0){const pane=mesh(new THREE.PlaneGeometry(2.0,1.15),glass,-1.303,2.21,1.58,bus);pane.rotation.y=-Math.PI/2;pane.castShadow=false;}
      if(side<0)box(.13,.06,6.9,cream,side*1.30,1.34,0,bus);
      else{box(.13,.06,4.38,cream,1.30,1.34,-1.21,bus);box(.13,.06,.78,cream,1.30,1.34,3.03,bus);}
    }
    box(2.57,1.12,.12,green,0,1.02,3.40,bus);box(2.56,.85,.12,cream,0,1.82,3.40,bus);
    const windshield=mesh(new THREE.PlaneGeometry(2.27,.79),glass,0,2.40,3.468,bus);windshield.castShadow=false;
    box(.065,.80,.06,cream,0,2.39,3.49,bus);box(2.43,.075,.09,cream,0,2.82,3.43,bus);box(2.40,.12,.25,chrome,0,.62,3.48,bus);
    box(2.58,1.17,.12,green,0,1.04,-3.40,bus);box(2.58,.14,.12,cream,0,2.96,-3.40,bus);
    const rear=mesh(new THREE.PlaneGeometry(2.25,1.16),glass,0,2.18,-3.468,bus);rear.rotation.y=Math.PI;rear.castShadow=false;
    box(2.42,.13,.19,chrome,0,.62,-3.49,bus);
    const destination=canvasTexture((ctx,w,h)=>{ctx.fillStyle='#253b36';ctx.fillRect(0,0,w,h);ctx.fillStyle='#f5d59a';ctx.font='bold 49px monospace';ctx.textAlign='center';ctx.fillText('07  NIGHT LINE',w/2,68);},640,100);
    mesh(new THREE.PlaneGeometry(2.22,.34),new THREE.MeshBasicMaterial({map:destination}),0,3.01,3.49,bus);
    for(const x of [-.88,.88]){
      mesh(new THREE.SphereGeometry(.12,12,8),new THREE.MeshBasicMaterial({color:0xffe5b4}),x,1.01,3.50,bus);
      const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:radial(),transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}));gl.position.set(x,1.01,3.57);gl.scale.set(.88,.88,1);bus.add(gl);
      const light=new THREE.SpotLight(0xffdd99,95,85,.30,.70,1.6);light.position.set(x,1.03,3.56);light.target.position.set(x,.08,22);bus.add(light,light.target);
      const beam=mesh(new THREE.ConeGeometry(1.5,9,12,1,true),new THREE.MeshBasicMaterial({color:0xffdca1,transparent:true,opacity:.025,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}),x,.85,8.0,bus);beam.rotation.x=-Math.PI/2;beam.castShadow=false;
      rounded(.14,.26,.04,new THREE.MeshBasicMaterial({color:0xfc7450}),x,1.12,-3.49,bus,.025);
    }
    busWheels=[];
    for(const x of [-1.28,1.28])for(const z of [-2.15,2.12]){
      const wheel=new THREE.Group();wheel.position.set(x,.51,z);bus.add(wheel);
      const tire=mesh(new THREE.CylinderGeometry(.50,.50,.22,18),rubber,0,0,0,wheel);tire.rotation.z=Math.PI/2;
      const hub=mesh(new THREE.CylinderGeometry(.24,.24,.24,12),chrome,0,0,0,wheel);hub.rotation.z=Math.PI/2;busWheels.push(wheel);
    }
    // Both door panels slide away from a real opening in the passenger-side wall.
    busDoors=[];
    for(const direction of [-1,1]){
      const panel=new THREE.Group();panel.position.set(1.36,0,1.8+direction*.40);bus.add(panel);panel.userData.baseZ=panel.position.z;panel.userData.direction=direction;
      box(.07,.73,.78,green,0,.92,0,panel);box(.07,.08,.78,cream,0,1.31,0,panel);box(.07,.08,.78,cream,0,2.91,0,panel);
      for(const z of [-.38,.38])box(.07,1.58,.06,cream,0,2.1,z,panel);
      const pane=mesh(new THREE.PlaneGeometry(.70,1.48),glass,.038,2.10,0,panel);pane.rotation.y=Math.PI/2;pane.castShadow=false;busDoors.push(panel);
    }
    box(.42,.12,1.45,chrome,1.43,.24,1.8,bus);box(.35,.12,1.40,interior,1.11,.39,1.8,bus);
    for(const x of [-.67,.67])for(const z of [-2.4,-1.25,-.10]){
      rounded(.62,.16,.56,seat,x,1.37,z,bus,.045);rounded(.64,.61,.12,seat,x,1.71,z-.28,bus,.055);box(.09,.80,.09,dark,x,.96,z,bus);
    }
    rounded(.62,.16,.56,seat,-.67,1.37,1.20,bus,.045);rounded(.64,.61,.12,seat,-.67,1.71,.92,bus,.055);box(.09,.80,.09,dark,-.67,.96,1.20,bus);
    for(const z of [-1.5,1.65]){box(.16,.04,.9,new THREE.MeshBasicMaterial({color:0xffdfab}),0,3.05,z,bus);const light=new THREE.PointLight(0xffce87,12,5,2);light.position.set(0,2.65,z);bus.add(light);}
    roadDustOrigins=Array.from({length:100},()=>[random(),random(),random(),random()]);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Array(300).fill(0),3));
    roadDust=new THREE.Points(geo,new THREE.PointsMaterial({map:radial(),color:0xbd9773,size:.28,transparent:true,opacity:0,depthWrite:false}));scene.add(roadDust);
  }
  function makeDust(){
    dustOrigins=[];for(let i=0;i<110;i++)dustOrigins.push([random()*8-.5,random()*3.1+.08,random()*5-2,random()]);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(dustOrigins.flatMap(p=>p.slice(0,3)),3));
    dust=new THREE.Points(g,new THREE.PointsMaterial({color:0xe1b270,size:.018,transparent:true,opacity:.26,depthWrite:false}));scene.add(dust);
  }
  function renderAt(t){
    const state=STORY.sample(t);
    camera.position.set(...state.camera.position);camera.lookAt(...state.camera.target);
    if(camera.fov!==state.camera.fov){camera.fov=state.camera.fov;camera.updateProjectionMatrix();}
    poseRobot(state.robot,t);
    bus.visible=state.bus.visible;bus.position.set(STORY.busX,0,state.bus.z);
    for(const panel of busDoors)panel.position.z=panel.userData.baseZ+panel.userData.direction*state.bus.door*.83;
    for(const wheel of busWheels)wheel.rotation.x=state.bus.wheelAngle;
    const braking=Math.sin(Math.PI*STORY.phase(t,23.5,29)),departure=STORY.phase(t,41,42.5);
    roadDust.material.opacity=t<23.5?0:t<29?.22*braking:t<41?0:.18*departure;
    const rp=roadDust.geometry.attributes.position;
    roadDustOrigins.forEach((d,i)=>{const age=(d[3]+t*.19)%1;rp.setXYZ(i,STORY.busX+(d[0]-.5)*(2+age*3),.12+d[1]*age*.85,state.bus.z-3.1-d[2]*age*9);});rp.needsUpdate=true;
    const flicker=1+.016*Math.sin(t*17)+.009*Math.sin(t*31);
    lamp.intensity=47*flicker;glow.material.opacity=.65*flicker;
    chestLight.material.color.setRGB(1,.54+.04*Math.sin(t*1.2),.20);
    const p=dust.geometry.attributes.position;
    dustOrigins.forEach((d,i)=>{p.setXYZ(i,((d[0]+.5+t*.17)%8)-.5,d[1]+Math.sin(t*.7+d[3]*12)*.055,d[2]+Math.sin(t*.2+d[3]*8)*.12);});p.needsUpdate=true;
    if(currentShot!==state.index){
      currentShot=state.index;
      el['shot-label'].textContent=`${String(currentShot+1).padStart(2,'0')} / ${state.shot.title.toUpperCase()}`;
      el['shot-heading'].textContent=`Shot ${String(currentShot+1).padStart(2,'0')} — ${state.shot.title}`;
      el['shot-note'].textContent=state.shot.note;el['camera-note'].textContent=state.shot.camera;
      el.film.setAttribute('aria-label',state.shot.note);
      shotButtons.forEach((button,i)=>{button.setAttribute('aria-pressed',String(i===currentShot));});
    }
    el.ending.style.opacity=state.ending;
    renderer.render(scene,camera);updateUI();
  }
  function updateUI(){
    const frames=Math.min(Math.floor(elapsed*FPS+1e-5),DURATION*FPS);
    el.timecode.value=`00:${String(Math.floor(frames/FPS)).padStart(2,'0')}:${String(frames%FPS).padStart(2,'0')}`;
    el.seek.value=elapsed;el.seek.style.setProperty('--progress',`${elapsed/DURATION*100}%`);
    el.seek.setAttribute('aria-valuetext',`${elapsed.toFixed(2)} of ${DURATION} seconds`);
  }
  function setStatus(){el.state.textContent=playing?'Playing':elapsed>=DURATION?'Film ended':'Paused';el.play.disabled=playing;el.pause.disabled=!playing;}
  function tick(now){
    if(!playing)return;
    elapsed=Math.min(DURATION,elapsed+(now-lastTick)/1000);lastTick=now;renderAt(elapsed);
    if(elapsed>=DURATION){pause();return;}animationId=requestAnimationFrame(tick);
  }
  function play(){
    if(playing)return;if(elapsed>=DURATION)elapsed=0;
    playing=true;lastTick=performance.now();setStatus();syncSound();animationId=requestAnimationFrame(tick);
  }
  function pause(){playing=false;cancelAnimationFrame(animationId);setStatus();stopSound();}
  function restart(){pause();elapsed=0;renderAt(0);play();}
  function jumpToShot(index){pause();elapsed=STORY.shots[index].start;renderAt(elapsed);play();}
  function isFullscreen(){return document.fullscreenElement===el.player||document.webkitFullscreenElement===el.player;}
  function toggleFullscreen(){
    if(isFullscreen()){(document.exitFullscreen||document.webkitExitFullscreen).call(document);return;}
    const request=el.player.requestFullscreen||el.player.webkitRequestFullscreen;if(request)request.call(el.player);
  }
  function syncFullscreenUI(){
    const active=isFullscreen();
    el.fullscreen.setAttribute('aria-pressed',String(active));
    el.fullscreen.querySelector('span').textContent=active?'Exit fullscreen':'Fullscreen';
    resize();
  }
  function resize(){
    const width=el.frame.clientWidth,height=el.frame.clientHeight;
    if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();renderAt(elapsed);
  }
  function stopSound(){
    soundRequest++;
    for(const source of audioSources){try{source.stop();}catch{}try{source.disconnect();}catch{}}audioSources=[];
    if(audioGain){audioGain.disconnect();audioGain=null;}
  }
  async function syncSound(){
    stopSound();if(!playing||!el.sound.checked)return;
    const request=soundRequest;
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Audio unavailable');
      audioContext ||= new Audio();await audioContext.resume();
      if(!playing||!el.sound.checked||request!==soundRequest)return;
      soundtrack ||= makeSoundtrack(audioContext);
      const offset=Math.min(DURATION,elapsed+(performance.now()-lastTick)/1000);if(offset>=DURATION)return;
      audioGain=audioContext.createGain();audioGain.gain.value=.7;audioGain.connect(audioContext.destination);
      const source=audioContext.createBufferSource();source.buffer=soundtrack;source.connect(audioGain);source.start(0,offset);audioSources.push(source);
    }catch{el.sound.checked=false;el.sound.disabled=true;el.sound.parentElement.title='Ambient sound is unavailable in this browser.';}
  }
  function makeSoundtrack(context){
    // One synthesized soundtrack with a fixed timeline: pause/resume and seeking
    // start at the corresponding audio offset, including engine, brakes and chime.
    const rate=context.sampleRate,buffer=context.createBuffer(1,Math.ceil(rate*DURATION),rate),data=buffer.getChannelData(0);
    let seed=719,brown=0,enginePhase=0;
    const gate=(t,a,b)=>{if(t<a||t>b)return 0;return Math.sin(Math.PI*(t-a)/(b-a));};
    const bell=(t,at,f)=>{const age=t-at;return age<0||age>1.7?0:Math.sin(age*2*Math.PI*f)*Math.exp(-age*4)*.043;};
    for(let i=0;i<data.length;i++){
      const t=i/rate;seed=(1664525*seed+1013904223)>>>0;const noise=seed/4294967296*2-1;brown=(brown+noise*.025)/1.025;
      const arrival=STORY.smooth(STORY.phase(t,12,25)),leave=1-STORY.smooth(STORY.phase(t,41.5,45));
      const motor=t<12?0:(.003+.035*arrival)*leave;
      const frequency=t<25?mixSound(37,49,arrival):t<41?33:mixSound(40,66,STORY.phase(t,41,44));
      enginePhase+=Math.PI*2*frequency/rate;
      let v=brown*.19*(.8+.2*Math.sin(t*.8))+Math.sin(t*2*Math.PI*60)*.0025;
      v+=motor*(Math.sin(enginePhase)+Math.sin(enginePhase*2.01)*.20);
      v+=noise*(.009*gate(t,6.4,7.2)+.008*gate(t,9.2,10.2)+.029*gate(t,25.6,26.8)+.015*gate(t,29.3,30.8)+.012*gate(t,40.25,40.95));
      v+=Math.sin(t*2*Math.PI*420)*(.003*gate(t,7.3,7.8)+.002*gate(t,14,17));
      v+=bell(t,30.0,659.25)+bell(t,30.24,830.61);
      if(t>34.6&&t<39.5){const cycle=(t-34.6)%(.375);v+=Math.sin(cycle*2*Math.PI*110)*Math.exp(-cycle*36)*.026;}
      data[i]=Math.max(-.8,Math.min(.8,v))*Math.min(1,t/.12,(DURATION-t)/.20);
    }
    return buffer;
  }
  function mixSound(a,b,t){return a+(b-a)*t;}
  function fail(message){
    pause();el.loading.hidden=true;el.error.hidden=false;el.error.textContent=message;
    for(const id of ['play','pause','restart','seek','sound'])el[id].disabled=true;
    shotButtons.forEach(button=>{button.disabled=true;});
    el.state.textContent='Unavailable';
  }
  try{
    if(typeof THREE==='undefined')throw new Error('The Three.js file could not load. Extract the complete ZIP before opening index.html, or use the standalone last-stop.html file.');
    if(!STORY)throw new Error('The story file could not load. Keep story.js with index.html, or use the standalone last-stop.html file.');
    makeWorld();elapsed=0;resize();
    el.loading.hidden=true;el.play.disabled=false;el.restart.disabled=false;el.seek.disabled=false;el.sound.disabled=false;setStatus();
    el.play.addEventListener('click',play);el.pause.addEventListener('click',pause);el.restart.addEventListener('click',restart);
    shotButtons.forEach((button,i)=>{button.disabled=false;button.addEventListener('click',()=>jumpToShot(i));});
    el.seek.addEventListener('input',()=>{pause();elapsed=Number(el.seek.value);renderAt(elapsed);setStatus();});
    el.sound.addEventListener('change',syncSound);
    if(el.player.requestFullscreen||el.player.webkitRequestFullscreen){
      el.fullscreen.disabled=false;el.fullscreen.addEventListener('click',toggleFullscreen);
      document.addEventListener('fullscreenchange',syncFullscreenUI);document.addEventListener('webkitfullscreenchange',syncFullscreenUI);
    }
    document.addEventListener('keydown',e=>{
      if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','BUTTON','TEXTAREA','SUMMARY'].includes(e.target.tagName)||e.target.isContentEditable)return;
      if(e.code==='Space'){e.preventDefault();playing?pause():play();}
      if(e.code==='KeyR'){e.preventDefault();restart();}
      if(e.code==='KeyF'&&!el.fullscreen.disabled){e.preventDefault();toggleFullscreen();}
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)pause();});
    window.addEventListener('resize',resize);
    el.film.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('The graphics connection was interrupted. Reload this page to restore the film.');});
  }catch(error){console.error(error);fail(error.message.includes('file could not load')?error.message:'This film needs WebGL 2 graphics. Try a current Chrome, Edge, Firefox or Safari browser with graphics acceleration enabled.');}
})();

