/* LAST STOP — the complete, deterministic 45-second timeline.
 * This file contains story timing and camera choices, independent of rendering.
 * Each call to sample(seconds) describes the entire scene at that exact moment.
 */
(() => {
  'use strict';
  const duration=45, busX=-4.15, stopZ=-1.25;
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
  const phase=(t,a,b)=>clamp((t-a)/(b-a));
  const blend=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
  const shots=[
    {start:0,end:5,title:'The wait',note:'An empty road. A tired little traveler. A light that stays on.',camera:'Slow dolly · Wide composition'},
    {start:5,end:12,title:'The ticket',note:'A bent ticket. The same small gesture. One more minute of hope.',camera:'Close insert · Gentle push in'},
    {start:12,end:20,title:'A little hope',note:'An engine in the distance. Two lights. A reason to look up.',camera:'Medium profile · A lift of the head'},
    {start:20,end:29,title:'The arrival',note:'The headlights find the stop. Dust settles. The bus is here.',camera:'Low wide · A measured arrival'},
    {start:29,end:37,title:'An invitation',note:'The doors open. A warm, empty cabin. The traveler decides.',camera:'Over the shoulder · A slow pull back'},
    {start:37,end:45,title:'A place to go',note:'A few small steps. A journey begins. The light stays on.',camera:'Departure wide · Hold on the shelter'}
  ];
  function sample(seconds){
    const t=clamp(Number(seconds)||0,0,duration);
    const index=Math.max(0,shots.findIndex(s=>t>=s.start&&(t<s.end||s.end===duration)));
    const shot=shots[index],u=smooth(phase(t,shot.start,shot.end));
    let busZ=-105;
    if(t>=12&&t<20)busZ=mix(-105,-42,phase(t,12,20));
    else if(t>=20&&t<27)busZ=mix(-42,stopZ,1-(1-phase(t,20,27))**2);
    else if(t>=27&&t<41)busZ=stopZ;
    else if(t>=41)busZ=stopZ+55*phase(t,41,45)**2;
    const door=smooth(phase(t,29.3,31.0))*(1-smooth(phase(t,40.25,40.95)));
    const stand=smooth(phase(t,33.1,34.6))*(1-smooth(phase(t,39.5,40.2)));
    let robotPosition=[2.87,.10,.45],yaw=-.24;
    let walk=0,boarded=false;
    if(t>=12)yaw=mix(-.24,-1.30,smooth(phase(t,12.8,17.6)));
    if(t>=34.2)yaw=mix(-1.30,-Math.PI/2,smooth(phase(t,34.2,35.0)));
    if(t>=33.1&&t<34.6)yaw=mix(-1.30,0,smooth(phase(t,33.1,34.6)));
    // Move forward from the bench before turning toward the road, clearing its leg.
    if(t>=34.6&&t<35.2){robotPosition=[2.87,.10,mix(.45,1.16,smooth(phase(t,34.6,35.2)))];yaw=mix(0,-Math.PI/2,smooth(phase(t,34.8,35.2)));walk=Math.sin(Math.PI*phase(t,34.6,35.2));}
    if(t>=35.2&&t<37){robotPosition=blend([2.87,.10,1.16],[-.80,.035,.50],phase(t,35.2,37));walk=1;}
    if(t>=37&&t<39.0){robotPosition=blend([-.80,.035,.50],[busX+1.43,.035,.50],phase(t,37,39));walk=1;}
    if(t>=39&&t<39.5){robotPosition=blend([busX+1.43,.035,.50],[busX+.70,.47,.50],smooth(phase(t,39,39.5)));walk=.8;}
    if(t>=39.5){
      const enter=smooth(phase(t,39.5,40.2));
      robotPosition=blend([busX+.70,.47,.50],[busX-.55,.47,busZ+1.30],enter);
      yaw=mix(-Math.PI/2,0,enter);boarded=true;
    }
    const look=mix(-.52,-.76,smooth(phase(t,13,18)));
    let position,target,fov;
    if(index===0){position=blend([-10.5,4.8,22.5],[-9.1,4.5,20.7],u);target=blend([-1,1.2,-3.4],[-.6,1.25,-3.4],u);fov=36;}
    if(index===1){position=blend([3.04,1.76,1.99],[2.94,1.60,1.81],u);target=[2.72,1.155,1.035];fov=35;}
    if(index===2){position=blend([.60,2.55,4.1],[.90,2.65,4.45],u);target=[1.75,1.57,-.80];fov=43;}
    if(index===3){position=blend([8.8,1.65,12.4],[8.35,1.75,11.7],u);target=blend([-2.8,1.50,-6.0],[-2.25,1.48,-.4],u);fov=43;}
    if(index===4){position=blend([5.2,2.65,2.50],[5.8,2.90,3.3],u);target=[-2.85,1.65,.5];fov=42;}
    if(index===5){position=blend([11.8,5.1,-11.0],[12.5,5.5,-12.7],u);target=blend([-1.5,1.35,7.8],[-1.5,1.35,10.5],u);fov=41;}
    return {t,index,shot,u,camera:{position,target,fov},robot:{position:robotPosition,yaw,stand,walk,look,boarded},bus:{visible:t>=12,z:busZ,door,wheelAngle:-(busZ+105)/.5},ending:phase(t,43.4,44.5)};
  }
  const story={duration,shots,busX,stopZ,sample,phase,smooth,mix};
  if(typeof module==='object'&&module.exports)module.exports=story;
  else window.LastStopStory=story;
})();

