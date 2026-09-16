import { motion, useMotionValue, useSpring, useTransform, useScroll } from "motion/react";
import { ArrowDown, ArrowUpRight, ChevronRight, Fingerprint, Globe2, Network, ShieldCheck, UsersRound, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { PublicNav } from "../components/PublicNav";

type Surface = { id: string; no: string; title: string; kicker: string; icon: typeof Fingerprint; copy: string; accent: string };
const surfaces: Surface[] = [
  { id:"identity", no:"01", title:"Identity", kicker:"WHO", icon:Fingerprint, accent:"#a9ff72", copy:"People, privileges, trust boundaries and ownership resolved into one view." },
  { id:"infrastructure", no:"02", title:"Infrastructure", kicker:"WHERE", icon:Globe2, accent:"#8ee8ff", copy:"The systems beneath the organization, connected to what depends on them." },
  { id:"applications", no:"03", title:"Applications", kicker:"WHAT", icon:Network, accent:"#c3a4ff", copy:"Applications and integrations understood through owners, access and dependencies." },
  { id:"policy", no:"04", title:"Policy", kicker:"WHY", icon:ShieldCheck, accent:"#ffb08c", copy:"Governance connected to the entities and decisions it is meant to control." },
  { id:"signals", no:"05", title:"Signals", kicker:"NOW", icon:Zap, accent:"#f6e77a", copy:"Change becomes useful when surrounding context explains why it matters." },
  { id:"people", no:"06", title:"People", kicker:"ACTORS", icon:UsersRound, accent:"#ff9ed8", copy:"The human layer behind responsibility, access, ownership and action." },
];
const trace = [
  ["12:41:08","Identity boundary verified","IDENTITY"],
  ["12:39:52","Application relationship changed","APPLICATIONS"],
  ["12:37:16","Infrastructure dependency resolved","INFRASTRUCTURE"],
  ["12:35:04","Policy context refreshed","POLICY"],
  ["12:32:47","Privileged actor relationship observed","PEOPLE"],
];
function Reveal({children,className="",delay=0}:{children:ReactNode;className?:string;delay?:number}){
  return <motion.div className={className} initial={{opacity:0,y:55,filter:"blur(10px)"}} whileInView={{opacity:1,y:0,filter:"blur(0px)"}} viewport={{once:false,amount:.18}} transition={{duration:.95,delay,ease:[.16,1,.3,1]}}>{children}</motion.div>;
}

function ScrollScene({children,className="",id}:{children:ReactNode;className?:string;id?:string}){
  const ref=useRef<HTMLElement>(null);
  const {scrollYProgress}=useScroll({target:ref,offset:["start 105%","end -5%"]});
  const y=useTransform(scrollYProgress,[0,.12,.42,.78,1],[90,18,0,-18,-80]);
  const scale=useTransform(scrollYProgress,[0,.16,.45,.82,1],[.94,.985,1,.99,.95]);
  const opacity=useTransform(scrollYProgress,[0,.09,.24,.76,.91,1],[0,.5,1,1,.6,0]);
  const blur=useTransform(scrollYProgress,[0,.12,.84,1],["12px","1.5px","0px","8px"]);
  const isIssue=className.includes("v8-issue");
  const isMethod=className.includes("v8-loop");
  const isSurfaces=className.includes("v8-surfaces");
  const isContext=className.includes("v8-context");
  const isTrace=className.includes("v8-trace");
  const isPrinciple=className.includes("v8-principle");
  const x=useTransform(scrollYProgress,[0,.22,.5,.8,1], isIssue?[-55,-8,0,8,42]:isMethod?[42,8,0,-8,-34]:isSurfaces?[-34,-5,0,5,28]:isContext?[46,7,0,-8,-38]:isTrace?[-28,-4,0,4,24]:isPrinciple?[28,4,0,-5,-26]:[0,0,0,0,0]);
  const rotate=useTransform(scrollYProgress,[0,.2,.5,.8,1], isIssue?[1.6,.4,0,-.4,-1.2]:isMethod?[-1.2,-.3,0,.3,.9]:isContext?[1.1,.25,0,-.25,-.9]:[.7,.15,0,-.15,-.6]);
  const rotateX=useTransform(scrollYProgress,[0,.25,.5,.75,1],[2.2,.5,0,-.5,-1.8]);
  const isLoop=className.includes("v8-loop");
  const revealOrigin=isLoop?"50% 50%":isContext?"78% 52%":"50% 50%";
  const clipPath=useTransform(scrollYProgress,[0,.14,.38,.68,.9,1], isLoop
    ? ["circle(18% at 72% 50%)","circle(42% at 72% 50%)","circle(78% at 68% 50%)","circle(100% at 60% 50%)","circle(100% at 48% 50%)","circle(92% at 40% 50%)"]
    : isContext
      ? ["circle(16% at 82% 50%)","circle(38% at 82% 50%)","circle(72% at 76% 50%)","circle(100% at 62% 50%)","circle(100% at 48% 50%)","circle(90% at 36% 50%)"]
      : ["inset(8% 12% 8% 12% round 28px)","inset(3% 6% 3% 6% round 20px)","inset(0% 0% 0% 0% round 0px)","inset(0% 0% 0% 0% round 0px)","inset(2% 3% 2% 3% round 18px)","inset(8% 12% 8% 12% round 28px)"]);
  const perspectiveY=useTransform(scrollYProgress,[0,.2,.5,.8,1], isLoop?[-4,-1,0,1,3]:isContext?[5,2,0,-2,-5]:[3,1,0,-1,-3]);
  return <section ref={ref} className={`v8-scene ${className}`} id={id}>
    <motion.div className="v8-scene-inner" style={{x,y,scale,rotate,rotateX,rotateY:perspectiveY,opacity,filter:blur,clipPath,transformOrigin:revealOrigin}}>{children}</motion.div>
  </section>;
}
export default function Home(){
  const [active,setActive]=useState("identity");
  const [filter,setFilter]=useState("ALL");
  const [menu,setMenu]=useState(false);
  const [chapter,setChapter]=useState("00");
  const [activeScene,setActiveScene]=useState("top");
  const root=useRef<HTMLElement>(null);
  const pointerX=useMotionValue(0); const pointerY=useMotionValue(0);
  const sx=useSpring(pointerX,{stiffness:70,damping:18}); const sy=useSpring(pointerY,{stiffness:70,damping:18});
  const {scrollYProgress}=useScroll();
  const progressX=useTransform(scrollYProgress,[0,1],[0,1]);
  const titleY=useTransform(scrollYProgress,[0,.15],[0,-100]);
  const giantX=useTransform(scrollYProgress,[0,.22],[0,-180]);
  const activeSurface=surfaces.find(s=>s.id===active) ?? surfaces[0];
  const ActiveIcon=activeSurface.icon;
  const filtered=filter==="ALL"?trace:trace.filter(t=>t[2]===filter);
  const onPointer=(e:MouseEvent<HTMLElement>)=>{const r=e.currentTarget.getBoundingClientRect();pointerX.set((e.clientX-r.left-r.width/2)/55);pointerY.set((e.clientY-r.top-r.height/2)/55)};
  useEffect(()=>{
    const ids=["top","issue","method","surfaces","blueprint","trace","principle","guardian-gate"];
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(visible){
        const i=ids.indexOf((visible.target as HTMLElement).id);
        if(i>=0){ setChapter(String(i).padStart(2,"0")); setActiveScene((visible.target as HTMLElement).id); }
      }
    },{threshold:[.2,.45,.7],rootMargin:"-12% 0px -12% 0px"});
    ids.forEach(id=>{const el=document.getElementById(id);if(el)observer.observe(el)});
    return()=>observer.disconnect();
  },[]);
  return <div ref={root} className="arka-v8" onMouseMove={onPointer} onMouseLeave={()=>{pointerX.set(0);pointerY.set(0)}}>
    <div className="v8-noise"/>
    <PublicNav/>
    <main className={`arka-main-scene scene-${activeScene}`}>
      <section className="v8-hero" id="top">
        <motion.div className="v8-hero-copy" style={{y:titleY}}>
          <div className="v8-index"><span>00</span><i/> ARKA / SECURITY INTELLIGENCE</div>
          <h1>Security<br/><em>needs</em><br/>context<span className="v8-dot">.</span></h1>
          <p>ARKA makes the relationships between people, systems, applications, policies and signals visible — so security teams can understand what is happening before they act.</p>
          <div className="v8-hero-actions"><Link to="/login" className="v8-black-btn">Enter ARKA <ArrowUpRight size={15}/></Link><a href="#issue" className="v8-text-btn">Start the tour <ArrowDown size={13}/></a></div>
        </motion.div>
        <div className="v8-hero-format">
          <motion.div className="v8-format-frame" style={{x:sx,y:sy}}>
            <div className="v8-frame-top"><span>FORMAT / 01</span><span>LIVE / 15:24:08</span></div>
            <motion.div className="v8-ark-type" style={{x:giantX}}>ARKA</motion.div>
            <div className="v8-frame-shape"><motion.div animate={{rotate:[0,90,180,270,360]}} transition={{duration:18,repeat:Infinity,ease:"linear"}} className="v8-shape-inner"/></div>
            <div className="v8-frame-note"><b>CONTEXT ENGINE</b><span>RELATIONSHIPS / STATE / CHANGE</span></div>
            <div className="v8-frame-axis"/>
          </motion.div>
          <div className="v8-side-index">01<br/>09</div>
        </div>
        <div className="v8-hero-bottom"><span>SECURITY IS A RELATIONSHIP PROBLEM</span><span>SCROLL TO EXPLORE ↓</span></div>
      </section>

      <ScrollScene className="v8-section v8-issue" id="issue">
        <div className="v8-section-label">01 — ISSUE</div>
        <Reveal className="v8-display"><span>The tools</span><span className="outline">multiply.</span><span>The context</span><span>disappears.</span></Reveal>
        <div className="v8-issue-foot"><p>Alerts are fragments. Assets are lists. Identities are records. ARKA connects them so a security event arrives with the surrounding story.</p><div><strong>06</strong><small>CONNECTED<br/>SURFACES</small></div></div>
      </ScrollScene>

      <ScrollScene className="v8-loop" id="method">
        <div className="v8-section-label">02 — METHOD</div>
        <div className="v8-loop-layout">
          <Reveal><div className="v8-eyebrow">ARKA / CONTEXT ENGINE</div><h2>Don't add<br/><em>another tool.</em></h2><p>Build the layer that lets every existing tool make more sense.</p></Reveal>
          <div className="v8-loop-wheel">
            <div className="v14-method-grid"/>
            <motion.div className="v8-wheel-orbit" animate={{rotate:360}} transition={{duration:24,repeat:Infinity,ease:"linear"}}/>
            <motion.div className="v14-method-orbit-two" animate={{rotate:-360}} transition={{duration:15,repeat:Infinity,ease:"linear"}}/>
            <motion.div className="v14-method-pulse" animate={{scale:[.72,1.15,.72],opacity:[.25,.72,.25]}} transition={{duration:3.2,repeat:Infinity,ease:"easeInOut"}}/>
            <div className="v8-wheel-center"><span>ARKA</span><small>CONTEXT</small></div>
            {[["OBSERVE",8],["CONNECT",92],["EXPLAIN",188],["ACT",278]].map(([label,deg],i)=><motion.button key={label} style={{transform:`rotate(${deg}deg) translateY(-185px) rotate(-${deg}deg)`}} animate={{y:[0,-8,0],scale:[1,1.05,1]}} transition={{duration:3+i*.25,repeat:Infinity,ease:"easeInOut",delay:i*.18}}>{label}</motion.button>)}
            <motion.div className="v14-method-beam" animate={{rotate:[0,90,180,270,360]}} transition={{duration:12,repeat:Infinity,ease:"linear"}}/>
          </div>
        </div>
      </ScrollScene>

      <ScrollScene className="v8-surfaces" id="surfaces">
        <div className="v8-section-label">03 — SURFACES</div>
        <div className="v8-surfaces-head"><h2>Six ways<br/><em>into context.</em></h2><p>Select one. The system reorganizes around it.</p></div>
        <div className="v8-surface-list">{surfaces.map((s,i)=>{const I=s.icon; return <button key={s.id} className={`v8-surface-row ${active===s.id?"active":""}`} onClick={()=>setActive(s.id)} style={{"--surface-accent":s.accent} as CSSProperties}><span className="v8-row-no">{s.no}</span><I size={18}/><strong>{s.title}</strong><small>{s.kicker}</small><span className="v8-row-copy">{s.copy}</span><ChevronRight className="v8-row-arrow" size={18}/><span className="v8-row-bar"/></button>})}</div>
      </ScrollScene>

      <ScrollScene className="v8-context" id="blueprint">
        <div className="v8-section-label">04 — CONTEXT</div>
        <div className="v8-context-grid">
          <Reveal><div className="v8-eyebrow">ACTIVE SURFACE / {activeSurface.no}</div><h2><ActiveIcon size={22}/>{activeSurface.title}</h2><p>{activeSurface.copy}</p><button className="v8-next" onClick={()=>setActive(surfaces[(surfaces.findIndex(s=>s.id===active)+1)%surfaces.length].id)}>NEXT RELATIONSHIP <ArrowUpRight size={14}/></button></Reveal>
          <div className="v8-context-stage" style={{"--active-accent":activeSurface.accent} as CSSProperties}><div className="v8-stage-word">{activeSurface.kicker}</div><div className="v8-stage-center">ARKA</div>{[0,1,2,3,4].map(i=><motion.span key={i} className={`v8-node n${i}`} animate={{y:[0,-8,0],opacity:[.55,1,.55]}} transition={{duration:2.8+i*.3,repeat:Infinity,delay:i*.18}}>{["WHO","WHAT","WHERE","WHY","NOW"][i]}</motion.span>)}<div className="v8-context-line l1"/><div className="v8-context-line l2"/><div className="v8-context-line l3"/></div>
        </div>
      </ScrollScene>

      <ScrollScene className="v8-trace" id="trace">
        <div className="v8-section-label">05 — TRACE</div>
        <div className="v8-trace-head"><Reveal><h2>What changed<br/><em>and why.</em></h2></Reveal><div className="v8-filter-line">{["ALL","IDENTITY","APPLICATIONS","INFRASTRUCTURE","POLICY"].map(f=><button key={f} className={filter===f?"active":""} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>
        <div className="v8-trace-list">{filtered.map(([time,text,cat],i)=><motion.button layout initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:i*.04}} key={time} className="v8-trace-row"><time>{time}</time><i/><strong>{text}</strong><small>{cat}</small><ArrowUpRight size={14}/></motion.button>)}</div>
      </ScrollScene>

      <ScrollScene className="v8-principle">
        <div className="v8-principle-marquee"><motion.div animate={{x:[0,-900]}} transition={{duration:22,repeat:Infinity,ease:"linear"}}>CONTEXT / CONTEXT / CONTEXT / CONTEXT /</motion.div></div>
        <Reveal><div className="v8-section-label">06 — PRINCIPLE</div><h2>Find the problem.<br/><span>See the relationship.<br/></span><em>Act with context.</em></h2></Reveal>
      </ScrollScene>

      <ScrollScene className="v8-gate-scene" id="guardian-gate">
        <div className="v8-gate">
          <div className="v8-gate-grid"/>
          <div className="v8-gate-top"><span>07 — GUARDIAN GATE</span><span>ARKA / SECURITY INTELLIGENCE</span></div>
          <div className="v8-gate-main"><div><div className="v8-eyebrow">THE SYSTEM IS READY</div><h2>Enter<br/><em>ARKA.</em></h2></div><Link to="/login" className="v8-gate-link">OPEN GUARDIAN GATE <ArrowUpRight size={16}/></Link></div>
          <div className="v8-gate-bottom"><span>IDENTITY AWARE</span><span>TENANT ISOLATED</span><span>GRAPH NATIVE</span><span>LIVE TRACE</span></div>
        </div>
      </ScrollScene>
    </main>
    <footer className="v8-footer"><span>© ARKA</span><span>SECURITY / CONTEXT / CONTROL</span><a href="#top">BACK TO TOP ↑</a></footer>
  </div>
}
