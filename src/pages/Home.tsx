import { motion, useMotionValue, useSpring, useTransform, useScroll } from "motion/react";
import { ArrowDown, ArrowUpRight, ChevronRight, Fingerprint, Globe2, Network, ShieldCheck, UsersRound, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { PublicNav } from "../components/PublicNav";

type Surface = { id:string; no:string; title:string; kicker:string; icon:typeof Fingerprint; copy:string; accent:string };
const surfaces:Surface[]=[
 {id:"identity",no:"01",title:"Identity",kicker:"WHO",icon:Fingerprint,accent:"#a9ff72",copy:"People, privileges, trust boundaries and ownership resolved into one view."},
 {id:"infrastructure",no:"02",title:"Infrastructure",kicker:"WHERE",icon:Globe2,accent:"#8ee8ff",copy:"The systems beneath the organization, connected to what depends on them."},
 {id:"applications",no:"03",title:"Applications",kicker:"WHAT",icon:Network,accent:"#c3a4ff",copy:"Applications and integrations understood through owners, access and dependencies."},
 {id:"policy",no:"04",title:"Policy",kicker:"WHY",icon:ShieldCheck,accent:"#ffb08c",copy:"Governance connected to the entities and decisions it is meant to control."},
 {id:"signals",no:"05",title:"Signals",kicker:"NOW",icon:Zap,accent:"#f6e77a",copy:"Change becomes useful when surrounding context explains why it matters."},
 {id:"people",no:"06",title:"People",kicker:"ACTORS",icon:UsersRound,accent:"#ff9ed8",copy:"The human layer behind responsibility, access, ownership and action."},
];
const trace=[
 ["12:41:08","Identity boundary verified","IDENTITY"],["12:39:52","Application relationship changed","APPLICATIONS"],["12:37:16","Infrastructure dependency resolved","INFRASTRUCTURE"],["12:35:04","Policy context refreshed","POLICY"],["12:32:47","Privileged actor relationship observed","PEOPLE"],
];

function useViewportProgress(ref:React.RefObject<HTMLElement|null>){
 const [p,setP]=useState(0);
 useEffect(()=>{
  let raf=0;
  const tick=()=>{const el=ref.current;if(el){const r=el.getBoundingClientRect();const h=Math.max(r.height,1);const vh=window.innerHeight;const raw=(vh-r.top)/(vh+h);setP(Math.max(0,Math.min(1,raw)));}raf=requestAnimationFrame(tick)};
  tick(); return()=>cancelAnimationFrame(raf);
 },[ref]);
 return p;
}

function KineticSection({id,className="",children,chapter,accent="#a9ff72"}:{id?:string;className?:string;children:ReactNode;chapter:string;accent?:string}){
 const ref=useRef<HTMLElement>(null); const p=useViewportProgress(ref);
 const enter=Math.min(1,p*2.2); const settle=Math.max(0,Math.min(1,(p-.18)*1.45));
 return <section ref={ref} id={id} className={`kx-section ${className}`} style={{"--kx-p":p,"--kx-enter":enter,"--kx-accent":accent} as CSSProperties}>
   <div className="kx-boundary" aria-hidden="true"><span>{chapter}</span><i/></div>
   <div className="kx-field" aria-hidden="true"><div className="kx-field-grid"/><div className="kx-field-glow"/></div>
   <div className="kx-curtain" aria-hidden="true" style={{transform:`scaleX(${Math.max(.001,1-enter)})`}}/>
   <div className="kx-inner" style={{transform:`translate3d(0,${(1-enter)*46}px,0) rotateX(${(1-enter)*2.5}deg) scale(${.985+settle*.015})`}}>{children}</div>
 </section>
}

export default function Home(){
 const [active,setActive]=useState("identity"); const [filter,setFilter]=useState("ALL");
 const root=useRef<HTMLElement>(null); const pointerX=useMotionValue(0); const pointerY=useMotionValue(0);
 const sx=useSpring(pointerX,{stiffness:70,damping:20}); const sy=useSpring(pointerY,{stiffness:70,damping:20});
 const {scrollYProgress}=useScroll();
 const heroY=useTransform(scrollYProgress,[0,.2],[0,-80]); const formatY=useTransform(scrollYProgress,[0,.25],[0,80]);
 const progress=useTransform(scrollYProgress,[0,1],[0,100]);
 const activeSurface=surfaces.find(s=>s.id===active)??surfaces[0]; const ActiveIcon=activeSurface.icon;
 const filtered=filter==="ALL"?trace:trace.filter(t=>t[2]===filter);
 const onPointer=(e:MouseEvent<HTMLElement>)=>{const r=e.currentTarget.getBoundingClientRect();pointerX.set((e.clientX-r.left-r.width/2)/60);pointerY.set((e.clientY-r.top-r.height/2)/60)};
 return <div ref={root} className="kx-site" onMouseMove={onPointer} onMouseLeave={()=>{pointerX.set(0);pointerY.set(0)}}>
   <div className="kx-page-line" aria-hidden="true"><span/><motion.i style={{top:useTransform(progress,v=>`${v}%`)}}/><b>ARKA</b></div>
   <PublicNav/>
   <main>
    <section id="top" className="kx-hero">
      <div className="kx-hero-grid" aria-hidden="true"/>
      <motion.div className="kx-hero-copy" style={{y:heroY}}>
        <div className="kx-meta"><b>00</b><i/> ARKA / SECURITY INTELLIGENCE</div>
        <h1><span>Security</span><em>needs</em><span>context<strong>.</strong></span></h1>
        <p>ARKA makes the relationships between people, systems, applications, policies and signals visible — so security teams can understand what is happening before they act.</p>
        <div className="kx-actions"><Link to="/login" className="kx-button">Enter ARKA <ArrowUpRight size={15}/></Link><a href="#issue" className="kx-link">Start the tour <ArrowDown size={13}/></a></div>
      </motion.div>
      <motion.div className="kx-hero-object" style={{x:sx,y:formatY}}>
        <div className="kx-object-frame"><div className="kx-object-head"><span>FORMAT / 01</span><span>LIVE / 15:24:08</span></div><div className="kx-object-word">ARKA</div><div className="kx-object-diamond"><motion.div animate={{rotate:[0,90,180,270,360],scale:[1,.9,1]}} transition={{duration:18,repeat:Infinity,ease:"linear"}}/></div><div className="kx-object-line"/><div className="kx-object-foot"><b>CONTEXT ENGINE</b><span>RELATIONSHIPS / STATE / CHANGE</span></div></div>
      </motion.div>
      <div className="kx-hero-bottom"><span>SECURITY IS A RELATIONSHIP PROBLEM</span><span>SCROLL TO EXPLORE ↓</span></div>
    </section>

    <KineticSection id="issue" chapter="01 — ISSUE" className="kx-issue" accent="#a9ff72">
      <div className="kx-issue-layout"><div className="kx-big-copy"><span>The tools</span><span className="kx-outline">multiply.</span><span>The context</span><span>disappears.</span></div><div className="kx-side-copy"><div className="kx-number">06</div><p>Alerts are fragments. Assets are lists. Identities are records. ARKA connects them so a security event arrives with the surrounding story.</p><span>CONNECTED SURFACES</span></div></div>
    </KineticSection>

    <KineticSection id="method" chapter="02 — METHOD" className="kx-method" accent="#8ee8ff">
      <div className="kx-method-layout"><div><div className="kx-eyebrow">ARKA / CONTEXT ENGINE</div><h2>Don't add<br/><em>another tool.</em></h2><p>Build the layer that lets every existing tool make more sense.</p></div><div className="kx-method-machine"><div className="kx-machine-ring r1"/><div className="kx-machine-ring r2"/><div className="kx-machine-beam"/><div className="kx-machine-core"><b>ARKA</b><small>CONTEXT</small></div>{["OBSERVE","CONNECT","EXPLAIN","ACT"].map((x,i)=><div key={x} className={`kx-machine-step step-${i+1}`}><small>0{i+1}</small><b>{x}</b></div>)}<motion.div className="kx-machine-particle" animate={{offsetDistance:["0%","100%"]}} transition={{duration:5,repeat:Infinity,ease:"linear"}}/></div></div>
    </KineticSection>

    <KineticSection id="surfaces" chapter="03 — SURFACES" className="kx-surfaces" accent="#c3a4ff">
      <div className="kx-surfaces-head"><h2>Six ways<br/><em>into context.</em></h2><p>Select one. The system reorganizes around it.</p></div>
      <div className="kx-surface-list">{surfaces.map(s=>{const I=s.icon;return <button key={s.id} className={`kx-surface-row ${active===s.id?"is-active":""}`} onClick={()=>setActive(s.id)} style={{"--row-accent":s.accent} as CSSProperties}><span>{s.no}</span><I size={18}/><strong>{s.title}</strong><small>{s.kicker}</small><p>{s.copy}</p><ChevronRight size={18}/><i/></button>})}</div>
    </KineticSection>

    <KineticSection id="blueprint" chapter="04 — CONTEXT" className="kx-context" accent={activeSurface.accent}>
      <div className="kx-context-layout"><div className="kx-context-copy"><div className="kx-eyebrow">ACTIVE SURFACE / {activeSurface.no}</div><h2><ActiveIcon size={22}/>{activeSurface.title}</h2><p>{activeSurface.copy}</p><button onClick={()=>setActive(surfaces[(surfaces.findIndex(s=>s.id===active)+1)%surfaces.length].id)}>NEXT RELATIONSHIP <ArrowUpRight size={14}/></button></div><div className="kx-context-stage"><div className="kx-stage-word">{activeSurface.kicker}</div><div className="kx-stage-core">ARKA<small>CONTEXT</small></div>{["WHO","WHAT","WHERE","WHY","NOW"].map((x,i)=><motion.span key={x} className={`kx-node node-${i}`} animate={{y:[0,-10,0]}} transition={{duration:2.5+i*.2,repeat:Infinity}}>{x}</motion.span>)}<div className="kx-rel rel-1"/><div className="kx-rel rel-2"/><div className="kx-rel rel-3"/></div></div>
    </KineticSection>

    <KineticSection id="trace" chapter="05 — TRACE" className="kx-trace" accent="#f6e77a">
      <div className="kx-trace-head"><h2>What changed<br/><em>and why.</em></h2><div className="kx-filters">{["ALL","IDENTITY","APPLICATIONS","INFRASTRUCTURE","POLICY"].map(f=><button key={f} className={filter===f?"is-active":""} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>
      <div className="kx-trace-list">{filtered.map(([time,text,cat],i)=><motion.div layout key={time} className="kx-trace-row" initial={{x:30,opacity:0}} animate={{x:0,opacity:1}} transition={{delay:i*.04}}><time>{time}</time><i/><strong>{text}</strong><small>{cat}</small><ArrowUpRight size={14}/></motion.div>)}</div>
    </KineticSection>

    <KineticSection chapter="06 — PRINCIPLE" className="kx-principle" accent="#ff9ed8">
      <div className="kx-principle-word">CONTEXT</div><div className="kx-principle-copy"><span>Find the problem.</span><span>See the relationship.</span><em>Act with context.</em></div>
    </KineticSection>

    <KineticSection id="guardian-gate" chapter="07 — GUARDIAN GATE" className="kx-gate-section" accent="#a9ff72">
      <div className="kx-gate"><div className="kx-gate-grid"/><div className="kx-gate-copy"><div className="kx-eyebrow">THE SYSTEM IS READY</div><h2>Enter<br/><em>ARKA.</em></h2></div><Link to="/login" className="kx-gate-button">OPEN GUARDIAN GATE <ArrowUpRight size={16}/></Link><div className="kx-gate-status"><span>IDENTITY AWARE</span><span>TENANT ISOLATED</span><span>GRAPH NATIVE</span><span>LIVE TRACE</span></div></div>
    </KineticSection>
   </main>
   <footer className="kx-footer"><span>© ARKA</span><span>SECURITY / CONTEXT / CONTROL</span><a href="#top">BACK TO TOP ↑</a></footer>
 </div>
}
