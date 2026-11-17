import { db } from "./firebase.js";
import { collection, doc, addDoc, getDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const form=document.querySelector("#registrationForm"), select=document.querySelector("#packageSelect");
const recipient=document.querySelector("#recipient"), msg=document.querySelector("#formMsg"), btn=document.querySelector("#submitBtn");
let packages=[], settings={registrationOpen:true,evRecipient:"Tariqul Sir",bmRecipient:"Rafiqul Sir",leaderboardEnabled:true,noticesEnabled:true};

const recipientFor=v=>v==="EV"?settings.evRecipient:v==="BM"?settings.bmRecipient:"Choose a version";
form.version.addEventListener("change",()=>recipient.textContent=recipientFor(form.version.value));

async function loadPublicData(){
  try{
    const [pSnap,sSnap]=await Promise.all([
      getDocs(query(collection(db,"packages"),where("active","==",true))),
      getDoc(doc(db,"publicSettings","main"))
    ]);
    packages=pSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>Number(a.amount)-Number(b.amount));
    if(sSnap.exists()) settings={...settings,...sSnap.data()};
    select.innerHTML='<option value="">Select a package</option>';
    packages.forEach(p=>{const o=document.createElement("option");o.value=p.id;o.textContent=`${p.name} — ৳${Number(p.amount).toLocaleString("en-BD")}`;select.append(o)});
    if(!packages.length)select.innerHTML='<option value="">Packages are not configured yet</option>';
    if(!settings.registrationOpen){btn.disabled=true;btn.textContent="Registration is currently closed";}
    await Promise.all([loadLeaderboard(),loadNotices()]);
  }catch(e){console.error(e);select.innerHTML='<option value="">Unable to load packages</option>';msg.textContent="Firebase setup or database rules need attention.";msg.className="message error"}
}
form.addEventListener("submit",async e=>{
  e.preventDefault();msg.textContent="";msg.className="message";
  const studentName=form.studentName.value.trim().replace(/\s+/g," "),studentClass=form.studentClass.value,version=form.version.value,packageId=select.value;
  const selected=packages.find(p=>p.id===packageId);
  if(!studentName||!studentClass||!["EV","BM"].includes(version)||!selected){msg.textContent="Complete all fields and select a valid package.";msg.classList.add("error");return}
  if(!settings.registrationOpen){msg.textContent="Registration is closed.";msg.classList.add("error");return}
  btn.disabled=true;btn.textContent="Submitting…";
  try{
    // The permanent registration is created once. Firestore rules prohibit public reads and all deletes.
    await addDoc(collection(db,"registrations"),{
      studentName,studentClass,version,packageId,packageName:selected.name,amount:Number(selected.amount),
      submitTo:recipientFor(version),paymentStatus:"pending",attendanceStatus:"unmarked",
      createdAt:serverTimestamp()
    });
    form.reset();recipient.textContent="Choose a version";msg.textContent="Registration submitted. Your contribution will appear on the leaderboard after admin confirmation.";msg.classList.add("success");
  }catch(err){console.error(err);msg.textContent="Could not submit. Please check your connection or ask the event admin.";msg.classList.add("error")}
  finally{btn.disabled=!settings.registrationOpen;btn.textContent=settings.registrationOpen?"Submit registration →":"Registration is currently closed"}
});
async function loadLeaderboard(){
  const box=document.querySelector("#leaderboard");
  if(!settings.leaderboardEnabled){box.textContent="Leaderboard is currently hidden.";return}
  try{
    const snap=await getDocs(query(collection(db,"publicLeaderboard"),where("visible","==",true),orderBy("amount","desc"),limit(50)));
    box.innerHTML="";
    if(snap.empty){box.innerHTML='<p class="muted">No confirmed contributions yet.</p>';return}
    snap.docs.forEach((d,i)=>{const x=d.data(),row=document.createElement("div");row.className="list-item";
      const rank=document.createElement("span");rank.className="rank";rank.textContent=["🥇","🥈","🥉"][i]||String(i+1);
      const main=document.createElement("div");main.className="item-main";const name=document.createElement("b");name.textContent=x.studentName||"Student";const sub=document.createElement("small");sub.textContent=`Class ${x.studentClass||""} ${x.version||""} · ${x.packageName||""}`;main.append(name,sub);
      const amount=document.createElement("span");amount.className="amount";amount.textContent=`৳${Number(x.amount||0).toLocaleString("en-BD")}`;row.append(rank,main,amount);box.append(row)
    });
  }catch(e){box.textContent="Leaderboard is unavailable right now."}
}
async function loadNotices(){
 const box=document.querySelector("#notices");
 if(!settings.noticesEnabled){box.textContent="Notice board is currently hidden.";return}
 try{
  const snap=await getDocs(query(collection(db,"publicNotices"),where("active","==",true),orderBy("createdAt","desc"),limit(30)));box.innerHTML="";
  if(snap.empty){box.innerHTML='<p class="muted">No notices published yet.</p>';return}
  snap.docs.forEach(d=>{const x=d.data(),item=document.createElement("article");item.className="notice";const title=document.createElement("b");title.textContent=x.title||"Notice";const body=document.createElement("p");body.textContent=x.body||"";const date=document.createElement("small");date.textContent=x.type==="absent"?"Absent notice":"Event notice";item.append(title,body,date);box.append(item)});
 }catch(e){box.textContent="Notices are unavailable right now."}
}
loadPublicData();
