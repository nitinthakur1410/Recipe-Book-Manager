let allRecipes = [];       // backend se aayi saari recipes
let editingId = null;      // edit mode mein recipe ka id
let currentRecipe = null;  // detail page par khuli recipe


// ---------- SECTIONS DIKHANE / CHUPANE ----------
function showSection(name) {
       const sections = ["listSection", "formSection", "detailSection", "cookSection", "onlineSection"];
    sections.forEach(function (s) {
        document.getElementById(s).classList.add("hidden");
    });
    document.getElementById(name).classList.remove("hidden");
}

function backToList() {
    showSection("listSection");
    loadRecipes();
}

// Text ko HTML mein safe banata hai
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}


// ---------- BACKEND SE RECIPES LAANA ----------
async function loadRecipes() {
    const response = await fetch("/api/recipes");
    allRecipes = await response.json();
    showList();
}


// ---------- SEARCH + FILTER ----------
function showList() {
    const search = document.getElementById("searchBox").value.toLowerCase().trim();
    const category = document.getElementById("categoryFilter").value;
    const type = document.getElementById("typeFilter").value;
    const favOnly = document.getElementById("favOnly").checked;

    const result = allRecipes.filter(function (r) {
        if (category !== "" && r.category !== category) return false;
        if (type !== "" && r.type !== type) return false;
        if (favOnly && r.favorite !== 1) return false;

        if (search !== "") {
            const text = (r.name + " " + r.category + " " + r.ingredients).toLowerCase();
            if (!text.includes(search)) return false;
        }
        return true;
    });

    // nayi recipe pehle dikhe
    result.reverse();
    showRecipes(result, "All Recipes");
}

// Recipes ke cards screen par banata hai
function showRecipes(recipes, title) {
    document.getElementById("listTitle").textContent = title;
    const list = document.getElementById("recipeList");
    list.innerHTML = "";

    if (recipes.length === 0) {
        list.innerHTML = "<p>No recipes found.</p>";
        return;
    }

    recipes.forEach(function (r) {
        let matchText = "";
        if (r.matched !== undefined) {
            matchText = "<p><b>Matched " + r.matched + " of " + r.total + " ingredients</b></p>";
        }

        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML =
            "<h3>" + escapeHtml(r.name) + "</h3>" +
            "<p>" + escapeHtml(r.category) + " | " + escapeHtml(r.type) +
            " | " + r.cook_time + " min | " + r.servings + " servings</p>" +
            matchText +
            "<button onclick='viewRecipe(" + r.id + ")'>View</button> " +
            "<button onclick='editRecipe(" + r.id + ")'>Edit</button> " +
            "<button class='red' onclick='deleteRecipe(" + r.id + ")'>Delete</button> " +
            "<button class='grey' onclick='toggleFavorite(" + r.id + ")'>" +
            (r.favorite === 1 ? "★ Favorite" : "☆ Favorite") + "</button>";
        list.appendChild(card);
    });
}

// id se recipe dhundta hai
function findRecipe(id) {
    return allRecipes.find(function (r) {
        return r.id === id;
    });
}


// ---------- ADD / EDIT ----------
function showAddForm() {
    editingId = null;
    document.getElementById("formTitle").textContent = "Add Recipe";
    document.getElementById("name").value = "";
    document.getElementById("cookTime").value = "";
    document.getElementById("servings").value = 1;
    document.getElementById("ingredients").value = "";
    document.getElementById("steps").value = "";
    showSection("formSection");
}

function editRecipe(id) {
    const r = findRecipe(id);
    editingId = id;
    document.getElementById("formTitle").textContent = "Edit Recipe";
    document.getElementById("name").value = r.name;
    document.getElementById("category").value = r.category;
    document.getElementById("type").value = r.type;
    document.getElementById("cookTime").value = r.cook_time;
    document.getElementById("servings").value = r.servings;
    document.getElementById("ingredients").value = r.ingredients;
    document.getElementById("steps").value = r.steps;
    showSection("formSection");
}

async function saveRecipe() {
    // form ka data backend ko bhejne ke liye
    const data = new URLSearchParams();
    data.append("name", document.getElementById("name").value);
    data.append("category", document.getElementById("category").value);
    data.append("type", document.getElementById("type").value);
    data.append("cook_time", document.getElementById("cookTime").value);
    data.append("servings", document.getElementById("servings").value);
    data.append("ingredients", document.getElementById("ingredients").value);
    data.append("steps", document.getElementById("steps").value);

    // editingId hai to edit wala route, nahi to add wala route
    let url = "/api/add";
    if (editingId !== null) {
        url = "/api/edit/" + editingId;
    }

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: data.toString()
    });
    const result = await response.json();

    if (response.ok) {
        alert(result.message);
        backToList();
    } else {
        alert(result.error);
    }
}


// ---------- DELETE ----------
async function deleteRecipe(id) {
    if (!confirm("Are you sure you want to delete this recipe?")) {
        return;
    }
    await fetch("/api/delete/" + id, { method: "POST" });
    loadRecipes();
}


// ---------- FAVORITE ----------
async function toggleFavorite(id) {
    await fetch("/api/favorite/" + id, { method: "POST" });
    loadRecipes();
}


// ---------- VIEW RECIPE + SERVINGS SCALER ----------
function viewRecipe(id) {
    currentRecipe = findRecipe(id);

    document.getElementById("detailName").textContent = currentRecipe.name;
    document.getElementById("detailInfo").textContent =
        currentRecipe.category + " | " + currentRecipe.type + " | " +
        currentRecipe.cook_time + " min";
    document.getElementById("newServings").value = currentRecipe.servings;
    document.getElementById("detailSteps").textContent = currentRecipe.steps;

    scaleIngredients();
    showSection("detailSection");
}

// Servings badalne par ingredients ki quantity badalta hai
function scaleIngredients() {
    const newServings = Number(document.getElementById("newServings").value);
    const ratio = newServings / currentRecipe.servings;

    const list = document.getElementById("detailIngredients");
    list.innerHTML = "";

    const lines = currentRecipe.ingredients.split("\n");
    lines.forEach(function (line) {
        line = line.trim();
        if (line === "") return;

        // line ke shuru mein number ho to usse ratio se multiply karo
        const match = line.match(/^(\d+(\.\d+)?)\s*(.*)/);
        let text = line;
        if (match && ratio > 0) {
            const newQty = Math.round(Number(match[1]) * ratio * 100) / 100;
            text = newQty + " " + match[3];
        }

        const li = document.createElement("li");
        li.textContent = text;
        list.appendChild(li);
    });
}


// ---------- WHAT CAN I COOK? ----------
function whatCanICook() {
    const input = document.getElementById("myIngredients").value;

    // "rice, onion" ko ["rice", "onion"] banao
    const myItems = input.split(",")
        .map(function (item) { return item.trim().toLowerCase(); })
        .filter(function (item) { return item !== ""; });

    if (myItems.length === 0) {
        alert("Please enter at least one ingredient");
        return;
    }

    const results = [];
    allRecipes.forEach(function (r) {
        const lines = r.ingredients.split("\n").filter(function (l) { return l.trim() !== ""; });
        let matched = 0;

        lines.forEach(function (line) {
            const lowerLine = line.toLowerCase();
            // user ka koi bhi item is line mein hai to match
            const found = myItems.some(function (item) { return lowerLine.includes(item); });
            if (found) matched++;
        });

        if (matched > 0) {
            // recipe ki copy banakar usme matched aur total jodte hain
            results.push(Object.assign({}, r, { matched: matched, total: lines.length }));
        }
    });

    // jiske zyada ingredients match hue wo pehle
    results.sort(function (a, b) { return b.matched - a.matched; });

    showSection("listSection");
    showRecipes(results, "Recipes you can cook");
}


// Page khulte hi saari recipes load karo
loadRecipes();


// ---------- ONLINE RECIPE SEARCH (TheMealDB) ----------
async function searchOnline() {
    const dish = document.getElementById("dishName").value.trim();
    if (dish === "") {
        alert("Please type a dish name");
        return;
    }

    // dish ka naam site ko bhejte hain
    const url = "https://www.themealdb.com/api/json/v1/1/search.php?s=" + encodeURIComponent(dish);

    let data;
    try {
        const response = await fetch(url);
        data = await response.json();
    } catch (error) {
        alert("Could not get the recipe. Please check your internet connection.");
        return;
    }

    const box = document.getElementById("onlineResults");
    box.innerHTML = "";

    // koi recipe nahi mili
    if (!data.meals) {
        box.innerHTML = "<p>No recipe found for '" + escapeHtml(dish) +
                        "'. Try another name, like chicken, pasta or egg.</p>";
        showSection("onlineSection");
        return;
    }

    // jitni recipes mili, har ek ka card banao
    data.meals.forEach(function (meal) {
        // site ingredients 1 se 20 tak alag-alag deti hai
        let ingredientsHtml = "";
        for (let i = 1; i <= 20; i++) {
            const name = meal["strIngredient" + i];
            const amount = meal["strMeasure" + i];
            if (name && name.trim() !== "") {
                ingredientsHtml += "<li>" + escapeHtml((amount || "").trim() + " " + name.trim()) + "</li>";
            }
        }

        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML =
            "<h3>" + escapeHtml(meal.strMeal) + "</h3>" +
            "<p>" + escapeHtml(meal.strCategory) + " | " + escapeHtml(meal.strArea) + "</p>" +
            "<img src='" + meal.strMealThumb + "' style='max-width:200px;border-radius:6px;'>" +
            "<h4>Ingredients</h4><ul>" + ingredientsHtml + "</ul>" +
            "<h4>Steps</h4><p class='steps'>" + escapeHtml(meal.strInstructions) + "</p>";
        box.appendChild(card);
    });

    showSection("onlineSection");
}