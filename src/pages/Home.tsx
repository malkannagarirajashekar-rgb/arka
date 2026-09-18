import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUpRight, ChevronRight, Fingerprint, Globe2, Network, ShieldCheck, UsersRound, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicNav } from "../components/PublicNav";

type Surface = { id:string; no:string; title:string; kicker:string; icon:typeof Fingerprint; copy:string; accent:string };
const surfaces:Surface[]=[
 {id:"identity",no:"01",title:"Identity",kicker:"WHO",icon:Fingerprint,accent:"#64b8ff",copy:"People, privileges, trust boundaries and ownership resolved into one view."},
 {id:"infrastructure",no:"02",title:"Infrastructure",kicker:"WHERE",icon:Globe2,accent:"#6ca8ff",copy:"The systems beneath the organization, connected to what depends on them."},
 {id:"applications",no:"03",title:"Applications",kicker:"WHAT",icon:Network,accent:"#8b7dff",copy:"Applications and integrations understood through owners, access and dependencies."},
 {id:"policy",no:"04",title:"Policy",kicker:"WHY",icon:ShieldCheck,accent:"#a277ff",copy:"Governance connected to the entities and decisions it is meant to control."},
 {id:"signals",no:"05",title:"Signals",kicker:"NOW",icon:Zap,accent:"#63d6ff",copy:"Change becomes useful when surrounding context explains why it matters."},
 {id:"people",no:"06",title:"People",kicker:"ACTORS",icon:UsersRound,accent:"#7c9cff",copy:"The human layer behind responsibility, access, ownership and action."},
];
const trace=[
 ["12:41:08","Identity boundary verified","IDENTITY"],["12:39:52","Application relationship changed","APPLICATIONS"],["12:37:16","Infrastructure dependency resolved","INFRASTRUCTURE"],["12:35:04","Policy context refreshed","POLICY"],["12:32:47","Privileged actor relationship observed","PEOPLE"],
];

function Reveal({children,className="",delay=0}:{children:ReactNode;className?:string;delay?:number}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const el=ref.current;if(!el)return;
  const io=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){el.classList.add("is-visible");io.disconnect()}},{threshold:.12,rootMargin:"0px 0px -8% 0px"});
  io.observe(el);return()=>io.disconnect();
 },[]);
 return <div ref={ref} className={`arka-reveal ${className}`} style={{"--delay":`${delay}ms`} as CSSProperties}>{children}</div>
}

function Section({id,label,children,className=""}:{id?:string;label:string;children:ReactNode;className?:string}){
 return <section id={id} className={`arka-section ${className}`}><div className="arka-section-rail"><span>{label}</span><i/></div><div className="arka-section-inner"><Reveal>{children}</Reveal></div></section>
}

export default function Home(){
 const [landingIntro, setLandingIntro] = useState(true);
 const [active,setActive]=useState("identity");
 const [filter,setFilter]=useState("ALL");
 const activeSurface=surfaces.find(s=>s.id===active)??surfaces[0];
 const ActiveIcon=activeSurface.icon;
 const filtered=filter==="ALL"?trace:trace.filter(t=>t[2]===filter);
 const next=()=>setActive(surfaces[(surfaces.findIndex(s=>s.id===active)+1)%surfaces.length].id);
 useEffect(()=>{
  const timer=window.setTimeout(()=>setLandingIntro(false),1200);
  return()=>window.clearTimeout(timer);
 },[]);
 return <div className="arka-flow arka-gradient-site">
   <div className={`arka-landing-intro ${landingIntro ? "is-active" : "is-complete"}`} aria-hidden="true">
     <div className="arka-landing-intro-grid"/>
     <div className="arka-landing-intro-beam"/>
     <div className="arka-landing-intro-core"><span/><i/><b>ARKA</b></div>
   </div>
   <PublicNav/>
   <main>
    <section id="top" className="arka-flow-hero">
      <div className="arka-hero-orbit orbit-a"/><div className="arka-hero-orbit orbit-b"/><div className="arka-hero-orbit orbit-c"/>
      <div className="arka-hero-grid" aria-hidden="true"/>
      <div className="arka-hero-layout">
        <Reveal className="arka-hero-copy">
          <div className="arka-overline"><span>00</span><i/> SECURITY / CONTEXT ENGINE</div>
          <h1>Security<br/><em>needs</em><br/>context<span>.</span></h1>
          <p>ARKA makes the relationships between people, systems, applications, policies and signals visible — so security teams can understand what is happening before they act.</p>
          <div className="arka-hero-actions"><Link to="/login" className="arka-primary">Enter ARKA <ArrowUpRight size={16}/></Link><a href="#issue" className="arka-text-action">Explore the system <ArrowDown size={14}/></a></div>
        </Reveal>
        <Reveal className="arka-hero-visual" delay={100}>
          <div className="arka-system-orbit">
            <div className="system-orbit-label"><span>ARKA / LIVE CONTEXT</span><b><i/> ONLINE</b></div>
            <div className="system-map">
              <div className="map-line line-a"/><div className="map-line line-b"/><div className="map-line line-c"/>
              <div className="map-node node-main"><strong>ARKA</strong><small>CONTEXT</small></div>
              {[["IDENTITY","01"],["SYSTEMS","02"],["POLICY","03"],["SIGNALS","04"]].map(([name,no],i)=><div key={name} className={`map-node map-${i+1}`}><small>{no}</small><strong>{name}</strong></div>)}
              <div className="map-pulse"/>
            </div>
            <div className="system-orbit-bottom"><span>RELATIONSHIPS</span><strong>VISIBLE / CONNECTED / LIVE</strong></div>
          </div>
        </Reveal>
      </div>
      <div className="arka-hero-footer"><span>SECURITY IS A RELATIONSHIP PROBLEM</span><span>SCROLL TO EXPLORE ↓</span></div>
    </section>

    <Section id="issue" label="01 — ISSUE" className="arka-issue">
      <div className="issue-grid"><div><div className="arka-kicker">THE FRAGMENTATION PROBLEM</div><h2>Tools multiply.<br/><span>Context disappears.</span></h2></div><div className="issue-note"><div className="issue-number">06</div><p>Alerts are fragments. Assets are lists. Identities are records. ARKA connects them so an event arrives with the surrounding story.</p><div className="issue-line"><i/> CONNECTED SURFACES</div></div></div>
    </Section>

    <Section id="method" label="02 — METHOD" className="arka-method">
      <div className="method-head"><div><div className="arka-kicker">ARKA / CONTEXT ENGINE</div><h2>Don't add another<br/><em>tool.</em></h2></div><p>Build the layer that lets every existing tool make more sense.</p></div>
      <div className="method-track">{["OBSERVE","CONNECT","EXPLAIN","ACT"].map((x,i)=><div className="method-step" key={x}><span>0{i+1}</span><div className="method-dot"/><strong>{x}</strong><small>{["Capture what changed.","Resolve relationships.","Surface surrounding context.","Give teams a reasoned next move."][i]}</small></div>)}</div>
    </Section>

    <Section id="surfaces" label="03 — SURFACES" className="arka-surfaces">
      <div className="surface-heading"><div><div className="arka-kicker">THE CONTEXT LAYER</div><h2>Six ways<br/><em>into context.</em></h2></div><p>Select a surface. The system reorganizes around it.</p></div>
      <div className="surface-grid">{surfaces.map(s=>{const I=s.icon;return <button key={s.id} className={`surface-card ${active===s.id?"is-active":""}`} onClick={()=>setActive(s.id)} style={{"--accent":s.accent} as CSSProperties}><span className="surface-no">{s.no}</span><div className="surface-icon"><I size={20}/></div><div className="surface-title"><strong>{s.title}</strong><small>{s.kicker}</small></div><p>{s.copy}</p><ChevronRight size={18}/><div className="surface-scan"/></button>})}</div>
    </Section>

    <Section id="blueprint" label="04 — CONTEXT" className="arka-context">
      <div className="context-shell" style={{"--accent":activeSurface.accent} as CSSProperties}>
        <div className="context-copy"><div className="arka-kicker">ACTIVE SURFACE / {activeSurface.no}</div><h2><ActiveIcon size={25}/>{activeSurface.title}</h2><p>{activeSurface.copy}</p><button onClick={next}>NEXT RELATIONSHIP <ArrowUpRight size={14}/></button></div>
        <div className="context-visual"><div className="context-grid"/><div className="context-core"><span>ARKA</span><small>CONTEXT</small></div><div className="context-orbit c1"/><div className="context-orbit c2"/>{["WHO","WHAT","WHERE","WHY","NOW"].map((x,i)=><span key={x} className={`context-node cn-${i}`}>{x}</span>)}<div className="context-route r1"/><div className="context-route r2"/><div className="context-route r3"/><div className="context-signal"/></div>
      </div>
    </Section>

    <Section id="trace" label="05 — TRACE" className="arka-trace">
      <div className="trace-head"><div><div className="arka-kicker">LIVE RELATIONSHIP TRACE</div><h2>What changed<br/><em>and why.</em></h2></div><div className="trace-filters">{["ALL","IDENTITY","APPLICATIONS","INFRASTRUCTURE","POLICY"].map(f=><button key={f} className={filter===f?"is-active":""} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>
      <div className="trace-list">{filtered.map(([time,text,cat],i)=><div className="trace-row" key={`${time}-${text}`} style={{"--delay":`${i*45}ms`} as CSSProperties}><time>{time}</time><i/><strong>{text}</strong><small>{cat}</small><ArrowUpRight size={15}/></div>)}</div>
    </Section>

    <Section label="06 — PRINCIPLE" className="arka-principle"><div className="principle-layout"><div className="principle-word">CONTEXT</div><div className="principle-copy"><span>Find the problem.</span><span>See the relationship.</span><em>Act with context.</em></div></div></Section>

    <Section id="guardian-gate" label="07 — GUARDIAN GATE" className="arka-gate-section"><div className="arka-gate-panel"><div className="gate-grid"/><div className="gate-copy"><div className="arka-kicker">THE SYSTEM IS READY</div><h2>Enter <em>ARKA.</em></h2></div><Link to="/login" className="arka-primary gate-button">Open Guardian Gate <ArrowUpRight size={16}/></Link><div className="gate-status"><span>IDENTITY AWARE</span><span>TENANT ISOLATED</span><span>GRAPH NATIVE</span><span>LIVE TRACE</span></div></div></Section>
   </main>
   <footer className="arka-contact-footer">
     <div className="arka-contact-glow" />
     <div className="arka-contact-top"><span>08 — CONTACT</span><span>ARKA / SECURITY / CONTEXT / CONTROL</span></div>
     <div className="arka-contact-main">
       <div><div className="arka-kicker">THE SYSTEM IS OPEN</div><h2>Security gets<br/><em>clearer with context.</em></h2></div>
       <Link to="/login" className="arka-contact-action"><span>Enter ARKA</span><ArrowUpRight size={18}/></Link>
     </div>
     <div className="arka-contact-bottom">
       <div><strong>ARKA</strong><span>SECURITY SYSTEMS</span></div>
       <div><span>IDENTITY AWARE</span><span>TENANT ISOLATED</span><span>GRAPH NATIVE</span><span>LIVE TRACE</span></div>
       <a href="#top">BACK TO TOP ↑</a>
     </div>
   </footer>
 </div>
}
