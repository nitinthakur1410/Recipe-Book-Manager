#include "httplib.h"
#define _WIN32_WINNT 0x0A00
#include <iostream>
#include <cctype>
#include "httplib.h"
#include "../database/database.h"
using namespace std;
using namespace httplib;

vector<Recipe> recipes;   // saari recipes memory mein
int nextId = 1;           // agli recipe ka id


// ---------- HELPER FUNCTIONS ----------

// Text ke shuru aur end ke extra spaces hatata hai
string trim(const string& text) {
    size_t start = 0;
    while (start < text.size() && isspace((unsigned char)text[start])) start++;
    size_t end = text.size();
    while (end > start && isspace((unsigned char)text[end - 1])) end--;
    return text.substr(start, end - start);
}

string toLower(string text) {
    for (size_t i = 0; i < text.size(); i++) {
        text[i] = tolower((unsigned char)text[i]);
    }
    return text;
}

// JSON mein bhejne ke liye text ko safe banata hai
string jsonText(const string& text) {
    string out = "";
    for (size_t i = 0; i < text.size(); i++) {
        char c = text[i];
        if (c == '"') out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else if (c == '\n') out += "\\n";
        else if (c == '\r') { }
        else if (c == '\t') out += " ";
        else out += c;
    }
    return out;
}

// Ek recipe ko JSON text mein badalta hai
string toJson(const Recipe& r) {
    string j = "{";
    j += "\"id\":" + to_string(r.id) + ",";
    j += "\"name\":\"" + jsonText(r.name) + "\",";
    j += "\"category\":\"" + jsonText(r.category) + "\",";
    j += "\"type\":\"" + jsonText(r.type) + "\",";
    j += "\"cook_time\":" + to_string(r.cookTime) + ",";
    j += "\"servings\":" + to_string(r.servings) + ",";
    j += "\"favorite\":" + to_string(r.favorite) + ",";
    j += "\"ingredients\":\"" + jsonText(r.ingredients) + "\",";
    j += "\"steps\":\"" + jsonText(r.steps) + "\"";
    j += "}";
    return j;
}

void sendMessage(Response& res, const string& message) {
    res.set_content("{\"message\":\"" + jsonText(message) + "\"}", "application/json");
}

void sendError(Response& res, int status, const string& message) {
    res.status = status;
    res.set_content("{\"error\":\"" + jsonText(message) + "\"}", "application/json");
}

// id se recipe dhundta hai (nahi mili to NULL)
Recipe* findRecipe(int id) {
    for (size_t i = 0; i < recipes.size(); i++) {
        if (recipes[i].id == id) return &recipes[i];
    }
    return NULL;
}

// Frontend ke form se Recipe banata hai
Recipe readForm(const Request& req) {
    Recipe r;
    r.id = 0;
    r.favorite = 0;
    r.name = trim(req.get_param_value("name"));
    r.category = trim(req.get_param_value("category"));
    r.type = trim(req.get_param_value("type"));
    r.cookTime = atoi(req.get_param_value("cook_time").c_str());
    r.servings = atoi(req.get_param_value("servings").c_str());
    r.ingredients = trim(req.get_param_value("ingredients"));
    r.steps = trim(req.get_param_value("steps"));
    return r;
}

// Input check karta hai. Sahi ho to "" return karta hai, galat ho to error message
string checkRecipe(const Recipe& r, int ignoreId) {
    if (r.name == "") return "Recipe name is required";
    if (r.ingredients == "") return "Ingredients are required";
    if (r.steps == "") return "Steps are required";
    if (r.cookTime < 0) return "Cooking time cannot be negative";
    if (r.servings < 1) return "Servings must be at least 1";

    // duplicate naam check
    for (size_t i = 0; i < recipes.size(); i++) {
        if (recipes[i].id != ignoreId && toLower(recipes[i].name) == toLower(r.name)) {
            return "A recipe with this name already exists";
        }
    }
    return "";
}


// ---------- MAIN ----------
int main() {
    recipes = loadRecipes();   // start hote hi file se data load
    for (size_t i = 0; i < recipes.size(); i++) {
        if (recipes[i].id >= nextId) nextId = recipes[i].id + 1;
    }

    Server svr;

    // frontend folder ki files (html, css, js) browser ko dene ke liye
    svr.set_mount_point("/", "./frontend");

    // ----- VIEW: saari recipes bhejo -----
    svr.Get("/api/recipes", [](const Request& req, Response& res) {
        string j = "[";
        for (size_t i = 0; i < recipes.size(); i++) {
            if (i > 0) j += ",";
            j += toJson(recipes[i]);
        }
        j += "]";
        res.set_content(j, "application/json");
    });

    // ----- ADD -----
    svr.Post("/api/add", [](const Request& req, Response& res) {
        Recipe r = readForm(req);
        string error = checkRecipe(r, -1);
        if (error != "") {
            sendError(res, 400, error);
            return;
        }
        r.id = nextId;
        nextId++;
        recipes.push_back(r);
        saveRecipes(recipes);
        sendMessage(res, "Recipe added successfully");
    });

    // ----- EDIT -----
    svr.Post(R"(/api/edit/(\d+))", [](const Request& req, Response& res) {
        int id = atoi(req.matches[1].str().c_str());
        Recipe* old = findRecipe(id);
        if (old == NULL) {
            sendError(res, 404, "Recipe not found");
            return;
        }
        Recipe r = readForm(req);
        string error = checkRecipe(r, id);
        if (error != "") {
            sendError(res, 400, error);
            return;
        }
        r.id = id;
        r.favorite = old->favorite;   // favorite status wahi rahega
        *old = r;
        saveRecipes(recipes);
        sendMessage(res, "Recipe updated successfully");
    });

    // ----- DELETE -----
    svr.Post(R"(/api/delete/(\d+))", [](const Request& req, Response& res) {
        int id = atoi(req.matches[1].str().c_str());
        for (size_t i = 0; i < recipes.size(); i++) {
            if (recipes[i].id == id) {
                recipes.erase(recipes.begin() + i);
                break;
            }
        }
        saveRecipes(recipes);
        sendMessage(res, "Recipe deleted successfully");
    });

    // ----- FAVORITE ON/OFF -----
    svr.Post(R"(/api/favorite/(\d+))", [](const Request& req, Response& res) {
        int id = atoi(req.matches[1].str().c_str());
        Recipe* r = findRecipe(id);
        if (r == NULL) {
            sendError(res, 404, "Recipe not found");
            return;
        }
        r->favorite = 1 - r->favorite;
        saveRecipes(recipes);
        sendMessage(res, "Favorite updated");
    });

    cout << "Recipe Book Manager is running.\n";
    cout << "Open in browser: http://localhost:8080\n";
    cout << "Press Ctrl+C to stop.\n";

    if (!svr.listen("127.0.0.1", 8080)) {
        cout << "Could not start server. Port 8080 may be in use.\n";
    }
    return 0;
}