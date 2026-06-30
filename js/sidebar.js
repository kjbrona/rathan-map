document.getElementById("app-title").textContent = APP_NAME;
document.getElementById("app-subtitle").textContent = APP_SUBTITLE;
async function loadCategories() {

    const response = await fetch("data/categories.json");

    const categories = await response.json();

    const list = document.getElementById("category-list");

    list.innerHTML = "";

    categories.forEach(category => {

        const label = document.createElement("label");

        label.innerHTML = `
            <input
                type="checkbox"
                ${category.enabled ? "checked" : ""}>
            ${category.icon} ${category.name}
        `;

        list.appendChild(label);

    });

}

loadCategories();