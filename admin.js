import { db, auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ADMIN_UID = "zHyIP5QcNAMj8Tdd40UJNjarkFH2"; // Configured with your Admin UID
const $ = (s) => document.querySelector(s);
let records = [],
  packages = [],
  notices = [],
  settings = {};
const DEFAULT_SETTINGS = {
  evRecipient: "Tariqul Sir",
  bmRecipient: "Rafiqul Sir",
  registrationOpen: true,
  leaderboardEnabled: true,
  noticesEnabled: true
};

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#loginMsg").textContent = "";
  try {
    await signInWithEmailAndPassword(
      auth,
      $("#email").value.trim(),
      $("#password").value
    );
  } catch (err) {
    console.error(err);
    $("#loginMsg").textContent =
      "Login failed. Check your details and Firebase Authentication setup.";
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user && user.uid !== ADMIN_UID) {
    $("#login").hidden = false;
    $("#app").hidden = true;
    $("#loginMsg").textContent =
      "This account is not authorized as a CPCS administrator.";
    await signOut(auth);
    return;
  }
  $("#login").hidden = !!user;
  $("#app").hidden = !user;
  if (user) await init();
});

$("#logout").onclick = () => signOut(auth);

document.querySelectorAll(".tabs button").forEach((b) => {
  b.onclick = () => {
    document
      .querySelectorAll(".tabs button")
      .forEach((x) => x.classList.toggle("active", x === b));
    document
      .querySelectorAll(".tab")
      .forEach((x) => (x.hidden = x.id !== b.dataset.tab));
  };
});

$("#search").oninput = renderRecords;
$("#versionFilter").onchange = renderRecords;
$("#statusFilter").onchange = renderRecords;

function say(t) {
  $("#globalMsg").textContent = t;
}

function validPrice(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 && n <= 100000000;
}

function cleanText(value, max = 100) {
  return String(value ?? "").trim().slice(0, max);
}

async function init() {
  try {
    await loadSettings();
    await Promise.all([loadRecords(), loadPackages(), loadNotices()]);
    // Reconcile existing absent records once an admin session opens; deterministic IDs prevent duplicates.
    await Promise.all(
      records
        .filter((r) => r.attendanceStatus === "absent")
        .map(syncAbsentNotice)
    );
    await loadNotices();
  } catch (e) {
    console.error(e);
    say(
      "Could not load admin data. Check the published Firestore rules and admin UID."
    );
  }
}

async function loadRecords() {
  const snap = await getDocs(
    query(collection(db, "registrations"), orderBy("createdAt", "desc"))
  );
  records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const confirmed = records.filter((x) => x.paymentStatus === "confirmed");
  $("#stats").textContent = `${records.length} registrations · ${
    confirmed.length
  } confirmed · ৳${confirmed
    .reduce((n, x) => n + Number(x.amount || 0), 0)
    .toLocaleString("en-BD")} confirmed`;
  renderRecords();
}

function renderRecords() {
  const q = $("#search").value.toLowerCase(),
    v = $("#versionFilter").value,
    st = $("#statusFilter").value;
  const body = $("#recordRows");
  body.innerHTML = "";
  records
    .filter(
      (x) =>
        (x.studentName || "").toLowerCase().includes(q) &&
        (!v || x.version === v) &&
        (!st || x.paymentStatus === st)
    )
    .forEach((x) => {
      const tr = document.createElement("tr");
      [
        x.studentName,
        `Class ${x.studentClass} ${x.version}`,
        x.packageName,
        `৳${Number(x.amount).toLocaleString("en-BD")}`,
        x.paymentStatus,
        x.attendanceStatus || "unmarked"
      ].forEach((c) => {
        const td = document.createElement("td");
        td.textContent = c || "";
        tr.append(td);
      });
      const td = document.createElement("td");
      const pay = document.createElement("button");
      pay.className =
        "small-btn " +
        (x.paymentStatus === "confirmed" ? "orange" : "green");
      pay.textContent =
        x.paymentStatus === "confirmed" ? "Set pending" : "Confirm";
      pay.onclick = () =>
        changeRecord(x, {
          paymentStatus:
            x.paymentStatus === "confirmed" ? "pending" : "confirmed"
        });
      const attendance = document.createElement("button");
      attendance.className = "small-btn light";
      attendance.textContent =
        x.attendanceStatus === "absent" ? "Mark present" : "Mark absent";
      attendance.onclick = () =>
        changeRecord(x, {
          attendanceStatus:
            x.attendanceStatus === "absent" ? "present" : "absent"
        });
      const edit = document.createElement("button");
      edit.className = "small-btn light";
      edit.textContent = "Edit";
      edit.onclick = () => editRecord(x);
      td.append(pay, attendance, edit);
      tr.append(td);
      body.append(tr);
    });
  if (!body.children.length)
    body.innerHTML = "<tr><td colspan='7'>No matching registrations.</td></tr>";
}

async function changeRecord(record, changes) {
  try {
    const updated = { ...record, ...changes };
    await updateDoc(doc(db, "registrations", record.id), {
      ...changes,
      updatedAt: serverTimestamp()
    });
    // Sync using the just-updated in-memory record, never stale list data.
    await syncPublicRecord(updated);
    if (Object.prototype.hasOwnProperty.call(changes, "attendanceStatus"))
      await syncAbsentNotice(updated);
    await loadRecords();
    await loadNotices();
    say("Record updated. Permanent contribution record retained.");
  } catch (e) {
    console.error(e);
    say("Update failed. Check Firestore permissions and network.");
  }
}

async function editRecord(x) {
  const name = prompt("Correct student name:", x.studentName);
  if (name === null) return;
  const cls = prompt("Class (8, 9 or 10):", x.studentClass);
  if (cls === null) return;
  const amount = prompt("Contribution amount (৳):", String(x.amount));
  if (amount === null) return;
  const n = Number(amount),
    normalizedName = cleanText(name, 80);
  if (
    normalizedName.length < 2 ||
    !["8", "9", "10"].includes(cls) ||
    !validPrice(n)
  ) {
    say("Invalid name, class or amount.");
    return;
  }
  try {
    const updated = {
      ...x,
      studentName: normalizedName,
      studentClass: cls,
      amount: n
    };
    await updateDoc(doc(db, "registrations", x.id), {
      studentName: normalizedName,
      studentClass: cls,
      amount: n,
      updatedAt: serverTimestamp()
    });
    await syncPublicRecord(updated);
    if (updated.attendanceStatus === "absent") await syncAbsentNotice(updated);
    await loadRecords();
    await loadNotices();
    say("Student record corrected.");
  } catch (e) {
    console.error(e);
    say("Could not edit record.");
  }
}

async function syncPublicRecord(x) {
  const ref = doc(db, "publicLeaderboard", x.id);
  await setDoc(
    ref,
    {
      studentName: x.studentName,
      studentClass: x.studentClass,
      version: x.version,
      packageName: x.packageName,
      amount: x.paymentStatus === "confirmed" ? Number(x.amount) : 0,
      visible: x.paymentStatus === "confirmed",
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

async function syncAbsentNotice(x) {
  const ref = doc(db, "publicNotices", `absent_${x.id}`);
  if (x.attendanceStatus === "absent") {
    await setDoc(
      ref,
      {
        title: "Absent student notice",
        body: `${x.studentName} · Class ${x.studentClass} · ${x.version} version`,
        type: "absent",
        studentId: x.id,
        studentName: x.studentName,
        studentClass: x.studentClass,
        version: x.version,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } else {
    const existing = await getDoc(ref);
    if (existing.exists())
      await updateDoc(ref, { active: false, updatedAt: serverTimestamp() });
  }
}

$("#packageForm").onsubmit = async (e) => {
  e.preventDefault();
  const name = cleanText($("#packageName").value, 80),
    amount = Number($("#packageAmount").value);
  if (name.length < 2 || !validPrice(amount)) {
    say("Enter a package name and a valid whole-number price.");
    return;
  }
  try {
    await addDoc(collection(db, "packages"), {
      name,
      amount,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    $("#packageForm").reset();
    await loadPackages();
    say("Package added.");
  } catch (e) {
    console.error(e);
    say("Could not add package.");
  }
};

async function loadPackages() {
  const snap = await getDocs(collection(db, "packages"));
  packages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const box = $("#packageRows");
  box.innerHTML = "";
  packages.forEach((p) => {
    const row = document.createElement("div");
    row.className = "pkg-row";
    const name = document.createElement("input");
    name.value = p.name || "";
    name.maxLength = 80;
    name.setAttribute("aria-label", "Package name");
    const amount = document.createElement("input");
    amount.type = "number";
    amount.min = "1";
    amount.max = "100000000";
    amount.step = "1";
    amount.value = p.amount;
    amount.setAttribute("aria-label", "Package price");
    const save = document.createElement("button");
    save.className = "small-btn";
    save.textContent = "Save";
    save.onclick = async () => {
      const newName = cleanText(name.value, 80),
        newAmount = Number(amount.value);
      if (newName.length < 2 || !validPrice(newAmount)) {
        say("Invalid package name or price.");
        return;
      }
      try {
        await updateDoc(doc(db, "packages", p.id), {
          name: newName,
          amount: newAmount,
          updatedAt: serverTimestamp()
        });
        await loadPackages();
        say("Package updated.");
      } catch (e) {
        console.error(e);
        say("Package update failed.");
      }
    };
    const toggle = document.createElement("button");
    toggle.className = "small-btn light";
    toggle.textContent = p.active ? "Disable" : "Enable";
    toggle.onclick = async () => {
      try {
        await updateDoc(doc(db, "packages", p.id), {
          active: !p.active,
          updatedAt: serverTimestamp()
        });
        await loadPackages();
        say("Package status updated.");
      } catch (e) {
        console.error(e);
        say("Could not change package status.");
      }
    };
    const status = document.createElement("small");
    status.textContent = p.active ? "Active" : "Disabled";
    row.append(name, amount, save, toggle, status);
    box.append(row);
  });
  if (!packages.length)
    box.textContent = "No packages yet. Add the first package above.";
}

$("#noticeForm").onsubmit = async (e) => {
  e.preventDefault();
  const title = cleanText($("#noticeTitle").value, 100),
    body = cleanText($("#noticeBody").value, 1000);
  if (title.length < 2 || !body) {
    say("Enter a title and description.");
    return;
  }
  try {
    await addDoc(collection(db, "publicNotices"), {
      title,
      body,
      type: "general",
      active: $("#noticePublish").checked,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    $("#noticeForm").reset();
    $("#noticePublish").checked = true;
    await loadNotices();
    say("Notice saved.");
  } catch (e) {
    console.error(e);
    say("Could not save notice.");
  }
};

async function loadNotices() {
  const snap = await getDocs(
    query(collection(db, "publicNotices"), orderBy("createdAt", "desc"))
  );
  notices = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const box = $("#noticeRows");
  box.innerHTML = "";
  notices.forEach((n) => {
    const row = document.createElement("div");
    row.className = "notice-row";
    const fields = document.createElement("div");
    fields.className = "notice-fields";
    const title = document.createElement("input");
    title.value = n.title || "";
    title.maxLength = 100;
    title.setAttribute("aria-label", "Notice title");
    const body = document.createElement("textarea");
    body.value = n.body || "";
    body.maxLength = 1000;
    body.setAttribute("aria-label", "Notice description");
    const meta = document.createElement("small");
    meta.textContent = `${n.type || "general"} · ${
      n.active ? "Published" : "Archived/hidden"
    }`;
    fields.append(title, body, meta);
    const actions = document.createElement("div");
    const save = document.createElement("button");
    save.className = "small-btn";
    save.textContent = "Save";
    save.onclick = async () => {
      if (n.type === "absent" || n.studentId) {
        say("Automatic absent notices are managed by attendance.");
        return;
      }
      const t = cleanText(title.value, 100),
        b = cleanText(body.value, 1000);
      if (t.length < 2 || !b) {
        say("Notice title and description are required.");
        return;
      }
      try {
        await updateDoc(doc(db, "publicNotices", n.id), {
          title: t,
          body: b,
          updatedAt: serverTimestamp()
        });
        await loadNotices();
        say("Notice updated.");
      } catch (e) {
        console.error(e);
        say("Notice update failed.");
      }
    };
    const toggle = document.createElement("button");
    toggle.className = "small-btn light";
    toggle.textContent = n.active ? "Unpublish" : "Publish";
    toggle.onclick = async () => {
      try {
        await updateDoc(doc(db, "publicNotices", n.id), {
          active: !n.active,
          updatedAt: serverTimestamp()
        });
        await loadNotices();
        say("Notice publication status updated.");
      } catch (e) {
        console.error(e);
        say("Could not change notice status.");
      }
    };
    actions.append(save, toggle);
    row.append(fields, actions);
    box.append(row);
  });
  if (!notices.length) box.textContent = "No notices yet.";
}

async function loadSettings() {
  const snap = await getDoc(doc(db, "publicSettings", "main"));
  settings = snap.exists()
    ? { ...DEFAULT_SETTINGS, ...snap.data() }
    : { ...DEFAULT_SETTINGS };
  $("#evRecipient").value = settings.evRecipient;
  $("#bmRecipient").value = settings.bmRecipient;
  $("#registrationOpen").checked = !!settings.registrationOpen;
  $("#leaderboardEnabled").checked = !!settings.leaderboardEnabled;
  $("#noticesEnabled").checked = !!settings.noticesEnabled;
}

$("#settingsForm").onsubmit = async (e) => {
  e.preventDefault();
  const ev = cleanText($("#evRecipient").value, 80),
    bm = cleanText($("#bmRecipient").value, 80);
  if (ev.length < 2 || bm.length < 2) {
    say("Enter valid teacher recipient names.");
    return;
  }
  try {
    settings = {
      evRecipient: ev,
      bmRecipient: bm,
      registrationOpen: $("#registrationOpen").checked,
      leaderboardEnabled: $("#leaderboardEnabled").checked,
      noticesEnabled: $("#noticesEnabled").checked
    };
    await setDoc(
      doc(db, "publicSettings", "main"),
      { ...settings, updatedAt: serverTimestamp() },
      { merge: true }
    );
    say("Website settings saved.");
  } catch (e) {
    console.error(e);
    say("Could not save settings.");
  }
};

$("#csv").onclick = () => {
  const header = [
    "Name",
    "Class",
    "Version",
    "Package",
    "Amount",
    "Payment status",
    "Attendance",
    "Submit to"
  ];
  const rows = records.map((x) => [
    x.studentName,
    x.studentClass,
    x.version,
    x.packageName,
    x.amount,
    x.paymentStatus,
    x.attendanceStatus,
    x.submitTo
  ]);
  const csv = [header, ...rows]
    .map((r) =>
      r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")
    )
    .join("\r\n");
  const a = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    );
  a.href = url;
  a.download = "cpcs-records.csv";
  a.click();
  URL.revokeObjectURL(url);
};
