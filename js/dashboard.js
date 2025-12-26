import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
    doc, getDoc, getDocs,
    collection, addDoc,
    updateDoc, increment,
    deleteDoc,
    query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { applyTheme } from "./theme.js";

let currentUserId = null;
let expenseChart = null;
let editModal = null;
function ensureAuth() {
    if (!currentUserId) {
        alert("Please login again");
        window.location.href = "index.html";
        return false;
    }
    return true;
}


/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUserId = user.uid;

    const userSnap = await getDoc(doc(db, "users", currentUserId));
    if (userSnap.exists()) {
        const u = userSnap.data();
        document.getElementById("userName").innerText = u.name;
        document.getElementById("userEmail").innerText = u.email;
        applyTheme(u.theme || "light", null);
    }

    document.getElementById("loadingText").style.display = "none";
    document.getElementById("dashboardContent").style.display = "block";

    document.getElementById("themeToggle")
        ?.addEventListener("change", e => {
            applyTheme(e.target.checked ? "dark" : "light", currentUserId);
        });

    document.getElementById("monthFilter")
        ?.addEventListener("change", loadExpenses);

    await loadBanks();
    await loadExpenses();
});

/* ================= BANKS ================= */


    window.addBank = async function () {
    if (!ensureAuth()) return;

    const bankNameInput = document.getElementById("bankName");
    const accountTypeInput = document.getElementById("accountType");
    const balanceInput = document.getElementById("balance");

    const bankName = bankNameInput.value.trim();
    const accountType = accountTypeInput.value;
    const balance = Number(balanceInput.value);

    if (!bankName || balance <= 0) {
        alert("Please enter valid bank details");
        return;
    }

    try {
        await addDoc(
            collection(db, "users", currentUserId, "banks"),
            {
                bankName,
                accountType,
                balance,
                createdAt: new Date()
            }
        );

        // Clear inputs
        bankNameInput.value = "";
        balanceInput.value = "";

        // Reload bank list
        loadBanks();

        alert("Bank added successfully!");
    } catch (error) {
        console.error("Error adding bank:", error);
        alert("Failed to add bank");
    }
};


async function loadBanks() {
    if (!currentUserId) return;


    const bankSelect = document.getElementById("expenseBank");
    const editBank = document.getElementById("editBank");
    const bankList = document.getElementById("bankList");

    bankSelect.innerHTML = `<option value="">Select Bank</option>`;
    editBank.innerHTML = "";
    bankList.innerHTML = "";

    const snapshot = await getDocs(
    query(
        collection(db, "users", currentUserId, "banks"),
        orderBy("balance", "desc")
    )
);


    snapshot.forEach(docSnap => {
        const bank = docSnap.data();

        const option = document.createElement("option");
        option.value = docSnap.id;
        option.textContent = bank.bankName;
        bankSelect.appendChild(option);

        const option2 = option.cloneNode(true);
        editBank.appendChild(option2);

        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between";
 li.className = "list-group-item d-flex justify-content-between align-items-center";

li.innerHTML = `
    <span>${bank.bankName} (${bank.accountType})</span>
    <div class="text-end">
        <small class="text-muted d-block">Remaining Balance</small>
        <strong>₹${bank.balance.toLocaleString()}</strong>
    </div>
`;


        bankList.appendChild(li);
    });
}

/* ================= ADD EXPENSE ================= */


    window.addExpense = async function () {
    if (!ensureAuth()) return;

    const amount = Number(document.getElementById("expenseAmount").value);
    const category = document.getElementById("expenseCategory").value;
    const bankId = document.getElementById("expenseBank").value;
    const date = document.getElementById("expenseDate").value;
    const description = document.getElementById("expenseDescription").value.trim();

    if (!amount || !bankId || !date) {
        alert("Please fill all required fields");
        return;
    }

    const bankRef = doc(db, "users", currentUserId, "banks", bankId);
    const bankSnap = await getDoc(bankRef);

    if (amount > bankSnap.data().balance) {
        alert("Insufficient balance!");
        return;
    }

    await addDoc(
        collection(db, "users", currentUserId, "expenses"),
        {
            amount,
            category,
            bankId,
            date,
            description,
            createdAt: new Date()
        }
    );

    await updateDoc(bankRef, {
        balance: increment(-amount)
    });

    // Clear inputs
    document.getElementById("expenseAmount").value = "";
    document.getElementById("expenseDescription").value = "";

    loadBanks();
    loadExpenses();
};


/* ================= LOAD EXPENSES ================= */

async function loadExpenses() {
    const list = document.getElementById("expenseList");
    list.innerHTML = "";

    const month = monthFilter.value;
    const totals = {};

    const q = query(
        collection(db, "users", currentUserId, "expenses"),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    snapshot.forEach(docSnap => {
        const e = docSnap.data();
        if (month && !e.date.startsWith(month)) return;

        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between";

        li.innerHTML = `
            <div>
                <strong>${e.category}</strong><br>
<small>${e.date}</small><br>
<small class="text-muted">${e.description || ""}</small>

            </div>
            <div>
                <span class="text-danger me-2">₹${e.amount}</span>
                <button class="btn btn-sm btn-warning me-1"
                    onclick="editExpense('${docSnap.id}','${e.bankId}',${e.amount},'${e.category}','${e.date}')">
                    Edit
                </button>
                <button class="btn btn-sm btn-danger"
                    onclick="deleteExpense('${docSnap.id}','${e.bankId}',${e.amount})">
                    Delete
                </button>
            </div>
        `;

        list.appendChild(li);
        totals[e.category] = (totals[e.category] || 0) + e.amount;
    });

    renderChart(totals);
    renderBankWiseCharts();


    const budget = Number(monthlyBudget.value);
    const spent = Object.values(totals).reduce((a, b) => a + b, 0);
    if (budget && spent > budget) alert("⚠ Monthly budget exceeded!");
}

/* ================= EDIT EXPENSE MODAL ================= */

window.editExpense = function (id, bankId, amount, category, date) {
    editExpenseId.value = id;
    editOldAmount.value = amount;
    editOldBankId.value = bankId;
    editAmount.value = amount;
    editCategory.value = category;
    editDate.value = date;
    editBank.value = bankId;

    editModal = new bootstrap.Modal(editExpenseModal);
    editModal.show();
};

window.saveEditedExpense = async function () {
    const id = editExpenseId.value;
    const oldAmount = Number(editOldAmount.value);
    const oldBankId = editOldBankId.value;

    const newAmount = Number(editAmount.value);
    const newCategory = editCategory.value;
    const newDate = editDate.value;
    const newBankId = editBank.value;

    // Restore old balance
    await updateDoc(
        doc(db, "users", currentUserId, "banks", oldBankId),
        { balance: increment(oldAmount) }
    );

    const newBankRef = doc(db, "users", currentUserId, "banks", newBankId);
    const bankSnap = await getDoc(newBankRef);

    if (newAmount > bankSnap.data().balance) {
        alert("Insufficient balance!");
        await updateDoc(
            doc(db, "users", currentUserId, "banks", oldBankId),
            { balance: increment(-oldAmount) }
        );
        return;
    }

    await updateDoc(newBankRef, { balance: increment(-newAmount) });

    await updateDoc(
        doc(db, "users", currentUserId, "expenses", id),
        {
            amount: newAmount,
            category: newCategory,
            date: newDate,
            bankId: newBankId
        }
    );

    editModal.hide();
    loadBanks();
    loadExpenses();
};

/* ================= DELETE ================= */

window.deleteExpense = async function (id, bankId, amount) {
    if (!confirm("Delete expense?")) return;

    await updateDoc(
        doc(db, "users", currentUserId, "banks", bankId),
        { balance: increment(amount) }
    );

    await deleteDoc(
        doc(db, "users", currentUserId, "expenses", id)
    );

    loadBanks();
    loadExpenses();
};

/* ================= UNDO ================= */

window.undoLastExpense = async function () {
    const q = query(
        collection(db, "users", currentUserId, "expenses"),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return alert("Nothing to undo");

    const docSnap = snapshot.docs[0];
    const e = docSnap.data();

    await updateDoc(
        doc(db, "users", currentUserId, "banks", e.bankId),
        { balance: increment(e.amount) }
    );

    await deleteDoc(
        doc(db, "users", currentUserId, "expenses", docSnap.id)
    );

    loadBanks();
    loadExpenses();
};

/* ================= EXPORT ================= */

window.exportToExcel = async function () {
    const selectedMonth = document.getElementById("monthFilter").value;

    // 1️⃣ Fetch all banks first
    const bankSnapshot = await getDocs(
        collection(db, "users", currentUserId, "banks")
    );

    const bankMap = {};
    bankSnapshot.forEach(docSnap => {
        const b = docSnap.data();
        bankMap[docSnap.id] = {
            bankName: b.bankName,
            accountType: b.accountType
        };
    });

    // 2️⃣ Fetch expenses
    const q = query(
        collection(db, "users", currentUserId, "expenses"),
        orderBy("date")
    );

    const snapshot = await getDocs(q);

    // 3️⃣ CSV Header
    let csv =
        "Date,Category,Amount,Bank Name,Account Type,Description\n";

    snapshot.forEach(docSnap => {
        const e = docSnap.data();

        // Month filter
        if (selectedMonth && !e.date.startsWith(selectedMonth)) return;

        const bank = bankMap[e.bankId] || {};
        const bankName = bank.bankName || "N/A";
        const accountType = bank.accountType || "N/A";
        const description = e.description
            ? e.description.replace(/,/g, " ")
            : "";

        csv +=
            `${e.date},${e.category},${e.amount},${bankName},${accountType},${description}\n`;
    });

    if (csv === "Date,Category,Amount,Bank Name,Account Type,Description\n") {
        alert("No data to export");
        return;
    }

    // 4️⃣ Download CSV
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = selectedMonth
        ? `expenses_${selectedMonth}.csv`
        : "expenses_all.csv";
    a.click();
};


/* ================= CHART ================= */

function renderChart(data) {
    const ctx = document.getElementById("expenseChart");
    if (!ctx) return;

    if (expenseChart) expenseChart.destroy();

    expenseChart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: [
                    "#ff6384",
                    "#36a2eb",
                    "#ffcd56",
                    "#4bc0c0",
                    "#9966ff",
                    "#ff9f40",
                    "#8bc34a",
                    "#9c27b0",
                    "#607d8b"
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

let bankCharts = {};

async function renderBankWiseCharts() {
    if (!currentUserId) return;
    const container = document.getElementById("bankCharts");
    container.innerHTML = "";

    const selectedMonth = document.getElementById("monthFilter").value;

    // 1️⃣ Get banks
    const bankSnap = await getDocs(
        collection(db, "users", currentUserId, "banks")
    );

    const banks = {};
    bankSnap.forEach(docSnap => {
        banks[docSnap.id] = {
            bankName: docSnap.data().bankName,
            totals: {}
        };
    });

    // 2️⃣ Get expenses
    const expSnap = await getDocs(
        collection(db, "users", currentUserId, "expenses")
    );

    expSnap.forEach(docSnap => {
        const e = docSnap.data();

        if (selectedMonth && !e.date.startsWith(selectedMonth)) return;

        if (!banks[e.bankId]) return;

        banks[e.bankId].totals[e.category] =
            (banks[e.bankId].totals[e.category] || 0) + e.amount;
    });

    // 3️⃣ Create charts
    Object.keys(banks).forEach(bankId => {
        const data = banks[bankId].totals;
        if (Object.keys(data).length === 0) return;

        const chartBox = document.createElement("div");
        chartBox.className = "mb-4";
        chartBox.innerHTML = `
            <h6>${banks[bankId].bankName}</h6>
            <div style="height:250px;">
                <canvas id="chart_${bankId}"></canvas>
            </div>
        `;

        container.appendChild(chartBox);

        const ctx = document
            .getElementById(`chart_${bankId}`)
            .getContext("2d");

        bankCharts[bankId] = new Chart(ctx, {
            type: "pie",
            data: {
                labels: Object.keys(data),
                datasets: [{
                    data: Object.values(data),
                    backgroundColor: [
                        "#ff6384",
                        "#36a2eb",
                        "#ffcd56",
                        "#4bc0c0",
                        "#9966ff",
                        "#ff9f40",
                        "#8bc34a",
                        "#9c27b0"
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    });
}



/* ================= LOGOUT ================= */

window.logout = function () {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
};
