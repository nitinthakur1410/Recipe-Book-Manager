#ifndef DATABASE_H
#define DATABASE_H

#include <string>
#include <vector>
#include <fstream>
#include <cstdlib>
using namespace std;

// Ek recipe ka structure
struct Recipe {
    int id;
    string name;
    string category;
    string type;         // Veg ya Non-veg
    int cookTime;        // minutes mein
    int servings;
    int favorite;        // 0 = nahi, 1 = haan
    string ingredients;  // har line mein ek ingredient, jaise "2 cup rice"
    string steps;        // har line mein ek step
};

// Data is file mein save hoga (program main folder se chalana hai)
const string DB_FILE = "database/recipes.txt";

// File mein ek recipe ek line mein hoti hai, isliye
// '|' ko '/' bana dete hain aur new line ko '~' bana dete hain
string fixText(const string& text) {
    string result = "";
    for (size_t i = 0; i < text.size(); i++) {
        char c = text[i];
        if (c == '|') result += '/';
        else if (c == '\n') result += '~';
        else if (c == '\r') { }
        else result += c;
    }
    return result;
}

// File se padhte time '~' ko wapas new line bana dete hain
string unfixText(const string& text) {
    string result = text;
    for (size_t i = 0; i < result.size(); i++) {
        if (result[i] == '~') result[i] = '\n';
    }
    return result;
}

// Ek line ko '|' se todkar alag-alag parts banata hai
vector<string> splitLine(const string& line) {
    vector<string> parts;
    string current = "";
    for (size_t i = 0; i < line.size(); i++) {
        if (line[i] == '|') {
            parts.push_back(current);
            current = "";
        } else {
            current += line[i];
        }
    }
    parts.push_back(current);
    return parts;
}

// File se saari recipes padhta hai
vector<Recipe> loadRecipes() {
    vector<Recipe> list;
    ifstream file(DB_FILE);

    if (!file) {
        return list;   // file nahi mili to khali list
    }

    string line;
    while (getline(file, line)) {
        vector<string> p = splitLine(line);
        if (p.size() < 9) {
            continue;   // kharab ya khali line chhod do
        }

        Recipe r;
        r.id = atoi(p[0].c_str());
        r.name = p[1];
        r.category = p[2];
        r.type = p[3];
        r.cookTime = atoi(p[4].c_str());
        r.servings = atoi(p[5].c_str());
        r.favorite = atoi(p[6].c_str());
        r.ingredients = unfixText(p[7]);
        r.steps = unfixText(p[8]);
        list.push_back(r);
    }

    file.close();
    return list;
}

// Saari recipes ko file mein likhta hai
void saveRecipes(const vector<Recipe>& list) {
    ofstream file(DB_FILE);

    for (size_t i = 0; i < list.size(); i++) {
        const Recipe& r = list[i];
        file << r.id << "|"
             << fixText(r.name) << "|"
             << fixText(r.category) << "|"
             << fixText(r.type) << "|"
             << r.cookTime << "|"
             << r.servings << "|"
             << r.favorite << "|"
             << fixText(r.ingredients) << "|"
             << fixText(r.steps) << "\n";
    }

    file.close();
}

#endif