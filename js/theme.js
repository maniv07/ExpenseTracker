import { db } from "./firebase.js";
import { doc, updateDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function applyTheme(theme, userId) {
    if (theme === "dark") {
        document.body.classList.add("dark");
        document.getElementById("themeToggle").checked = true;
    } else {
        document.body.classList.remove("dark");
        document.getElementById("themeToggle").checked = false;
    }

    // Save locally for login/signup pages
    localStorage.setItem("theme", theme);

    // Save to Firestore if logged in
    if (userId) {
        await updateDoc(doc(db, "users", userId), {
            theme: theme
        });
    }
}
