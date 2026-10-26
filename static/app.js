// ==========================================
// AI-Powered Smart Shop Management Dashboard - Merged Stock & Dashboard Logic
// Written with simple, beginner-friendly JavaScript
// ==========================================

let currentProducts = [];

// ------------------------------------------
// 1. Tab Switching
// ------------------------------------------
function switchTab(tabName) {
    const tabs = document.querySelectorAll(".tab-content");
    tabs.forEach(tab => tab.classList.remove("active"));

    const navButtons = document.querySelectorAll(".nav-item");
    navButtons.forEach(btn => btn.classList.remove("active"));

    const targetTab = document.getElementById("tab-" + tabName);
    if (targetTab) {
        targetTab.classList.add("active");
    }

    const activeBtn = document.getElementById("tab-btn-" + tabName);
    if (activeBtn) {
        activeBtn.classList.add("active");
    }

    if (tabName === "dashboard") {
        loadDashboardReports();
        loadGeminiConfig();
    } else if (tabName === "stock") {
        loadProducts();
    } else if (tabName === "sales") {
        loadProducts().then(() => {
            populateSalesProductDatalist();
        });
        loadSalesHistory();
    }
}

// ------------------------------------------
// 2. Google Gemini AI Configuration Logic
// ------------------------------------------
let geminiKeyVisible = false;

function loadGeminiConfig() {
    const input = document.getElementById("gemini-api-key-input");
    const badge = document.getElementById("gemini-config-status-badge");
    if (!badge) return;

    badge.className = "badge badge-warning";
    badge.innerText = "Checking...";

    fetch("/api/config/gemini-key")
        .then(res => res.json())
        .then(data => {
            if (data.configured) {
                badge.className = "badge badge-success";
                badge.innerText = "Configured";
                if (input && !input.dataset.userEditing) {
                    input.value = data.api_key || "";
                }
            } else {
                badge.className = "badge badge-danger";
                badge.innerText = "Not Configured";
                if (input && !input.dataset.userEditing) {
                    input.value = "";
                }
            }
        })
        .catch(err => {
            console.error("Gemini config load error:", err);
            badge.className = "badge badge-danger";
            badge.innerText = "Error";
        });
}

function toggleGeminiKeyVisibility() {
    const input = document.getElementById("gemini-api-key-input");
    const label = document.getElementById("toggle-key-label");
    if (!input || !label) return;

    geminiKeyVisible = !geminiKeyVisible;
    input.type = geminiKeyVisible ? "text" : "password";
    label.innerText = geminiKeyVisible ? "Hide" : "Show";
}

function handleSaveGeminiKey(event) {
    if (event) event.preventDefault();
    const input = document.getElementById("gemini-api-key-input");
    const alertBox = document.getElementById("gemini-config-alert");
    const submitBtn = document.getElementById("save-gemini-key-btn");
    const badge = document.getElementById("gemini-config-status-badge");
    if (!input) return;

    const key = input.value.trim();
    if (submitBtn) submitBtn.disabled = true;

    fetch("/api/config/gemini-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key })
    })
    .then(res => res.json())
    .then(data => {
        if (alertBox) {
            alertBox.style.display = "block";
            alertBox.className = "gemini-config-alert alert-success";
            alertBox.innerText = data.message || "Key saved to .env successfully!";
            setTimeout(() => { alertBox.style.display = "none"; }, 4000);
        }
        if (badge) {
            if (data.configured) {
                badge.className = "badge badge-success";
                badge.innerText = "Configured";
            } else {
                badge.className = "badge badge-danger";
                badge.innerText = "Not Configured";
            }
        }
    })
    .catch(err => {
        if (alertBox) {
            alertBox.style.display = "block";
            alertBox.className = "gemini-config-alert alert-error";
            alertBox.innerText = "Failed to save key: " + err.message;
        }
    })
    .finally(() => {
        if (submitBtn) submitBtn.disabled = false;
    });
}

function handleTestGeminiKey() {
    const input = document.getElementById("gemini-api-key-input");
    const alertBox = document.getElementById("gemini-config-alert");
    const testBtn = document.getElementById("test-gemini-key-btn");
    if (!input) return;

    const key = input.value.trim();
    if (!key) {
        if (alertBox) {
            alertBox.style.display = "block";
            alertBox.className = "gemini-config-alert alert-error";
            alertBox.innerText = "Please paste a Gemini API key first to test.";
        }
        return;
    }

    if (testBtn) testBtn.disabled = true;
    if (alertBox) {
        alertBox.style.display = "block";
        alertBox.className = "gemini-config-alert";
        alertBox.innerText = "Testing connection with Google Gemini...";
    }

    fetch("/api/config/gemini-key/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key })
    })
    .then(res => res.json())
    .then(data => {
        if (alertBox) {
            alertBox.style.display = "block";
            if (data.status === "success") {
                alertBox.className = "gemini-config-alert alert-success";
                alertBox.innerText = data.message;
            } else {
                alertBox.className = "gemini-config-alert alert-error";
                alertBox.innerText = data.message || "Test failed.";
            }
        }
    })
    .catch(err => {
        if (alertBox) {
            alertBox.style.display = "block";
            alertBox.className = "gemini-config-alert alert-error";
            alertBox.innerText = "Error testing connection: " + err.message;
        }
    })
    .finally(() => {
        if (testBtn) testBtn.disabled = false;
    });
}

// ------------------------------------------
// 2B. Dashboard Reports & Recap Management
// ------------------------------------------
let currentRecapPeriod = "today";

function changeRecapPeriod(period) {
    currentRecapPeriod = period;
    
    // Update active state on period filter buttons
    const periodButtons = document.querySelectorAll(".period-btn");
    periodButtons.forEach(btn => {
        if (btn.getAttribute("data-period") === period) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    loadDashboardReports();
}

function loadDashboardReports() {
    const periodTitles = {
        "today": "Today's",
        "7days": "7 Days",
        "30days": "30 Days",
        "all": "All-Time"
    };
    const periodLabel = periodTitles[currentRecapPeriod] || "Today's";

    // Update dynamic header text
    const revenueLabel = document.getElementById("kpi-revenue-label");
    const salesLabel = document.getElementById("kpi-sales-label");
    const topDesc = document.getElementById("recap-top-products-desc");

    if (revenueLabel) revenueLabel.innerText = `${periodLabel} Revenue`;
    if (salesLabel) salesLabel.innerText = `${periodLabel} Bills`;
    if (topDesc) topDesc.innerText = `Best performers (${periodLabel})`;

    return fetch(`/api/reports/summary?period=${currentRecapPeriod}`)
        .then(response => {
            if (!response.ok) throw new Error("Failed to load reports summary");
            return response.json();
        })
        .then(data => {
            renderDashboardRecap(data);
        })
        .catch(err => {
            console.error("Dashboard reports error:", err);
        });
}

function renderDashboardRecap(data) {
    // 1. KPI Cards
    const kpiRevenue = document.getElementById("kpi-revenue");
    const kpiRevenueAllTime = document.getElementById("kpi-revenue-alltime");
    const kpiSalesCount = document.getElementById("kpi-sales-count");
    const kpiSalesAllTime = document.getElementById("kpi-sales-alltime");
    const kpiProfit = document.getElementById("kpi-profit");
    const kpiMargin = document.getElementById("kpi-margin");
    const kpiInventoryVal = document.getElementById("kpi-inventory-val");
    const kpiInventoryItems = document.getElementById("kpi-inventory-items");
    const kpiProductsCount = document.getElementById("kpi-products-count");
    const kpiLowStockCount = document.getElementById("kpi-low-stock-count");
    const kpiOutStockCount = document.getElementById("kpi-out-stock-count");

    if (kpiRevenue) kpiRevenue.innerText = `₹${data.period_revenue.toFixed(2)}`;
    if (kpiRevenueAllTime) kpiRevenueAllTime.innerText = `₹${data.total_revenue.toFixed(2)}`;
    if (kpiSalesCount) kpiSalesCount.innerText = data.period_sales_count;
    if (kpiSalesAllTime) kpiSalesAllTime.innerText = data.total_sales_count;
    if (kpiProfit) kpiProfit.innerText = `₹${data.period_profit.toFixed(2)}`;
    if (kpiMargin) kpiMargin.innerText = `${data.profit_margin_pct}%`;
    if (kpiInventoryVal) kpiInventoryVal.innerText = `₹${data.inventory_val_retail.toFixed(2)}`;
    if (kpiInventoryItems) kpiInventoryItems.innerText = data.total_inventory_items;
    if (kpiProductsCount) kpiProductsCount.innerText = data.total_products;
    if (kpiLowStockCount) kpiLowStockCount.innerText = data.low_stock_count;
    if (kpiOutStockCount) kpiOutStockCount.innerText = data.out_of_stock_count;

    // 2. Top Selling Products
    const topBody = document.getElementById("top-products-table-body");
    if (topBody) {
        if (!data.top_products || data.top_products.length === 0) {
            topBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No sales recorded in this period yet.</td></tr>`;
        } else {
            let html = "";
            data.top_products.forEach((p, idx) => {
                const rankText = `#${idx + 1} `;
                html += `
                    <tr>
                        <td><span class="code-tag">${escapeHtml(p.code)}</span></td>
                        <td><strong>${rankText}${escapeHtml(p.name)}</strong></td>
                        <td style="text-align: right; font-weight: 600;">${p.quantity_sold}</td>
                        <td style="text-align: right; color: var(--success); font-weight: 700;">₹${p.total_revenue.toFixed(2)}</td>
                    </tr>
                `;
            });
            topBody.innerHTML = html;
        }
    }

    // 3. Recent Sales Activity in Home Dashboard
    const recentBody = document.getElementById("dashboard-recent-sales-body");
    if (recentBody) {
        if (!data.recent_sales || data.recent_sales.length === 0) {
            recentBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No sales recorded yet.</td></tr>`;
        } else {
            let html = "";
            data.recent_sales.forEach(sale => {
                const date = new Date(sale.created_at);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                html += `
                    <tr>
                        <td><strong style="color:var(--primary-color);">${escapeHtml(sale.sale_number)}</strong></td>
                        <td style="color:var(--text-muted); font-size:0.85rem;">${timeStr}</td>
                        <td style="max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(sale.item_summary)}">
                            ${escapeHtml(sale.item_summary)}
                        </td>
                        <td style="text-align: right;"><strong style="color:var(--success);">₹${sale.total_amount.toFixed(2)}</strong></td>
                        <td style="text-align: center;">
                            <button class="btn btn-secondary btn-sm" onclick="viewReceiptById(${sale.id})">Receipt</button>
                        </td>
                    </tr>
                `;
            });
            recentBody.innerHTML = html;
        }
    }

    // 4. Low Stock / Restock Needed Table
    const lowStockBody = document.getElementById("low-stock-table-body");
    if (lowStockBody) {
        if (!data.low_stock_items || data.low_stock_items.length === 0) {
            lowStockBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--success); padding: 1.5rem;">All items are well-stocked. No alerts.</td></tr>`;
        } else {
            let html = "";
            data.low_stock_items.forEach(item => {
                const isOut = item.stock_quantity === 0;
                const badge = isOut 
                    ? `<span class="badge badge-danger">Out of Stock</span>`
                    : `<span class="badge badge-warning">${item.stock_quantity} left</span>`;

                html += `
                    <tr>
                        <td><span class="code-tag">${escapeHtml(item.code)}</span></td>
                        <td>
                            <strong>${escapeHtml(item.name)}</strong>
                            <div style="font-size: 0.76rem; color: var(--text-muted);">Alert at: ${item.low_stock_threshold} ${escapeHtml(item.unit)}s</div>
                        </td>
                        <td>${badge}</td>
                        <td style="text-align: center;">
                            <button class="btn btn-primary btn-sm" onclick="quickRestockFromDashboard(${item.id})">Restock</button>
                        </td>
                    </tr>
                `;
            });
            lowStockBody.innerHTML = html;
        }
    }

    // 5. Category Breakdown Table
    const catBody = document.getElementById("category-table-body");
    if (catBody) {
        if (!data.category_breakdown || data.category_breakdown.length === 0) {
            catBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No categories available.</td></tr>`;
        } else {
            let html = "";
            data.category_breakdown.forEach(cat => {
                html += `
                    <tr>
                        <td><strong>${escapeHtml(cat.category)}</strong></td>
                        <td style="text-align: center;"><span class="badge badge-secondary">${cat.product_count}</span></td>
                        <td style="text-align: right; font-weight: 600;">${cat.total_stock} units</td>
                    </tr>
                `;
            });
            catBody.innerHTML = html;
        }
    }
}

function quickRestockFromDashboard(productId) {
    const found = currentProducts.find(p => p.id === productId);
    if (found) {
        openStockModal(productId);
    } else {
        loadProducts().then(() => {
            openStockModal(productId);
        });
    }
}

// ------------------------------------------
// 3. Stock & Product Listing
// ------------------------------------------
function loadProducts() {
    const searchInput = document.getElementById("product-search-input");
    const showArchived = document.getElementById("show-archived-checkbox");
    const tableBody = document.getElementById("products-table-body");

    const searchTerm = searchInput ? searchInput.value.trim() : "";
    const archivedOnly = showArchived ? showArchived.checked : false;

    // If checked, request ONLY archived products; otherwise, request ONLY active products
    let url = "/api/products?archived_only=" + archivedOnly;
    if (searchTerm) {
        url += "&search=" + encodeURIComponent(searchTerm);
    }

    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:2rem;">Loading stock...</td></tr>`;

    return fetch(url)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch products");
            return response.json();
        })
        .then(products => {
            currentProducts = products;
            renderProductsTable(products);
            populateSalesProductDatalist();
            return products;
        })
        .catch(error => {
            console.error("Error loading products:", error);
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--danger-color); padding:2rem;">Error loading stock from database.</td></tr>`;
            return [];
        });
}

function renderProductsTable(products) {
    const tableBody = document.getElementById("products-table-body");
    
    if (products.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:2rem;">No items found. Click "+ Add New Product" to create one.</td></tr>`;
        return;
    }

    let rowsHtml = "";
    products.forEach(product => {
        const isLowStock = product.stock_quantity <= (product.low_stock_threshold || 10);

        // Display current quantity with a low-stock alert badge if below threshold
        const stockDisplay = isLowStock
            ? `<strong>${product.stock_quantity}</strong> <span class="badge badge-danger" style="margin-left:0.35rem; font-size:0.75rem;" title="Alert threshold: ${product.low_stock_threshold}">Low Stock</span>`
            : `<strong>${product.stock_quantity}</strong>`;

        const statusBadge = product.is_active
            ? `<span class="badge badge-success">Active</span>`
            : `<span class="badge badge-secondary">Archived</span>`;

        // Active products have + Stock, Edit, Archive. Archived products have Unarchive option.
        const actionButtons = product.is_active
            ? `
                <div style="display:flex; gap:0.4rem; align-items:center;">
                    <button class="btn btn-primary btn-sm" onclick="openStockModal(${product.id})">+ Stock</button>
                    <button class="btn btn-secondary btn-sm" onclick="openEditModal(${product.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="archiveProduct(${product.id})">Archive</button>
                </div>
              `
            : `
                <div style="display:flex; gap:0.4rem; align-items:center;">
                    <button class="btn btn-secondary btn-sm" onclick="unarchiveProduct(${product.id})">Unarchive</button>
                </div>
              `;

        rowsHtml += `
            <tr>
                <td><span class="code-tag">${escapeHtml(product.code)}</span></td>
                <td><strong>${escapeHtml(product.name)}</strong></td>
                <td>${escapeHtml(product.category)}</td>
                <td>₹${product.selling_price.toFixed(2)}</td>
                <td>${stockDisplay}</td>
                <td>${escapeHtml(product.unit)}</td>
                <td>${statusBadge}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = rowsHtml;
}

function handleProductSearch() {
    loadProducts();
}

// ------------------------------------------
// 4. Code Auto-Suggestion
// ------------------------------------------
function handleNameInputForCodeSuggestion() {
    const productId = document.getElementById("form-product-id").value;
    if (productId) return; // Don't overwrite code when editing

    const nameInput = document.getElementById("form-name");
    const codeInput = document.getElementById("form-code");
    const name = nameInput.value.trim();

    if (!name) {
        codeInput.value = "";
        return;
    }

    fetch("/api/products/suggest-code?name=" + encodeURIComponent(name))
        .then(response => response.json())
        .then(data => {
            if (data.suggested_code) {
                codeInput.value = data.suggested_code;
            }
        })
        .catch(err => console.error("Suggest code error:", err));
}

// ------------------------------------------
// 5. Add / Edit Product Modal & Dropdown Handlers
// ------------------------------------------
function handleCategorySelectChange() {
    const select = document.getElementById("form-category-select");
    const customInput = document.getElementById("form-category-custom");
    if (select.value === "Other") {
        customInput.style.display = "block";
        customInput.required = true;
        customInput.focus();
    } else {
        customInput.style.display = "none";
        customInput.required = false;
        customInput.value = "";
    }
}

function handleUnitSelectChange() {
    const select = document.getElementById("form-unit-select");
    const customInput = document.getElementById("form-unit-custom");
    if (select.value === "Other") {
        customInput.style.display = "block";
        customInput.required = true;
        customInput.focus();
    } else {
        customInput.style.display = "none";
        customInput.required = false;
        customInput.value = "";
    }
}

function openAddProductModal() {
    document.getElementById("modal-title").innerText = "Add New Product";
    document.getElementById("form-product-id").value = "";
    document.getElementById("form-code").disabled = false;
    document.getElementById("product-form").reset();

    // Reset Category dropdown & custom input
    document.getElementById("form-category-select").value = "";
    document.getElementById("form-category-custom").style.display = "none";
    document.getElementById("form-category-custom").required = false;
    document.getElementById("form-category-custom").value = "";

    // Reset Unit dropdown & custom input
    document.getElementById("form-unit-select").value = "";
    document.getElementById("form-unit-custom").style.display = "none";
    document.getElementById("form-unit-custom").required = false;
    document.getElementById("form-unit-custom").value = "";

    document.getElementById("form-threshold").value = "10";
    document.getElementById("form-error").style.display = "none";
    document.getElementById("product-modal").style.display = "flex";
}

function openEditModal(productId) {
    const product = currentProducts.find(p => p.id === productId);
    if (!product) return;

    document.getElementById("modal-title").innerText = "Edit: " + product.name;
    document.getElementById("form-product-id").value = product.id;
    document.getElementById("form-name").value = product.name;
    document.getElementById("form-code").value = product.code;
    document.getElementById("form-code").disabled = true;

    // Populate Category: check if standard dropdown option exists
    const categorySelect = document.getElementById("form-category-select");
    const categoryCustom = document.getElementById("form-category-custom");
    let categoryFound = false;
    for (let opt of categorySelect.options) {
        if (opt.value && opt.value.toLowerCase() === product.category.toLowerCase()) {
            categorySelect.value = opt.value;
            categoryFound = true;
            break;
        }
    }
    if (categoryFound) {
        categoryCustom.style.display = "none";
        categoryCustom.required = false;
        categoryCustom.value = "";
    } else {
        categorySelect.value = "Other";
        categoryCustom.style.display = "block";
        categoryCustom.required = true;
        categoryCustom.value = product.category;
    }

    document.getElementById("form-selling-price").value = product.selling_price;
    document.getElementById("form-purchase-cost").value = product.purchase_cost || 0;
    document.getElementById("form-stock").value = product.stock_quantity;
    document.getElementById("form-threshold").value = product.low_stock_threshold || 10;

    // Populate Unit: check if standard dropdown option exists
    const unitSelect = document.getElementById("form-unit-select");
    const unitCustom = document.getElementById("form-unit-custom");
    let unitFound = false;
    for (let opt of unitSelect.options) {
        if (opt.value && opt.value.toLowerCase() === product.unit.toLowerCase()) {
            unitSelect.value = opt.value;
            unitFound = true;
            break;
        }
    }
    if (unitFound) {
        unitCustom.style.display = "none";
        unitCustom.required = false;
        unitCustom.value = "";
    } else {
        unitSelect.value = "Other";
        unitCustom.style.display = "block";
        unitCustom.required = true;
        unitCustom.value = product.unit;
    }

    document.getElementById("form-error").style.display = "none";
    document.getElementById("product-modal").style.display = "flex";
}

function closeProductModal() {
    document.getElementById("product-modal").style.display = "none";
}

function handleProductFormSubmit(event) {
    event.preventDefault();

    const productId = document.getElementById("form-product-id").value;
    const errorBox = document.getElementById("form-error");
    errorBox.style.display = "none";

    // Resolve Category (from dropdown or custom text)
    const categorySelect = document.getElementById("form-category-select").value;
    const categoryCustom = document.getElementById("form-category-custom").value.trim();
    const finalCategory = (categorySelect === "Other") ? categoryCustom : categorySelect;
    if (!finalCategory) {
        errorBox.style.display = "block";
        errorBox.innerText = "Please select or type a product category.";
        return;
    }

    // Resolve Unit (from dropdown or custom text)
    const unitSelect = document.getElementById("form-unit-select").value;
    const unitCustom = document.getElementById("form-unit-custom").value.trim();
    const finalUnit = (unitSelect === "Other") ? unitCustom : unitSelect;
    if (!finalUnit) {
        errorBox.style.display = "block";
        errorBox.innerText = "Please select or type a unit of measure.";
        return;
    }

    const payload = {
        name: document.getElementById("form-name").value.trim(),
        category: finalCategory,
        selling_price: parseFloat(document.getElementById("form-selling-price").value),
        purchase_cost: parseFloat(document.getElementById("form-purchase-cost").value) || 0.0,
        stock_quantity: parseInt(document.getElementById("form-stock").value, 10),
        low_stock_threshold: parseInt(document.getElementById("form-threshold").value, 10) || 10,
        unit: finalUnit
    };

    let url = "/api/products";
    let method = "POST";

    if (productId) {
        url = "/api/products/" + productId;
        method = "PUT";
    } else {
        payload.code = document.getElementById("form-code").value.trim().toUpperCase();
    }

    fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(async response => {
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Failed to save product.");
        }
        return data;
    })
    .then(() => {
        closeProductModal();
        loadProducts();
        loadDashboardReports();
    })
    .catch(error => {
        errorBox.style.display = "block";
        errorBox.innerText = error.message;
    });
}

// ------------------------------------------
// 6. Adjust Stock Modal (+ Stock in Actions)
// ------------------------------------------
function openStockModal(productId) {
    const product = currentProducts.find(p => p.id === productId);
    if (!product) return;

    document.getElementById("stock-product-id").value = product.id;
    document.getElementById("stock-product-name").innerText = product.name;
    document.getElementById("stock-product-code").innerText = product.code;
    document.getElementById("stock-product-current").innerText = `${product.stock_quantity} ${product.unit}s`;
    
    // Reset inputs
    document.getElementById("stock-form").reset();
    document.querySelector('input[name="stock-action-type"][value="add"]').checked = true;
    updateStockModalLabels();
    document.getElementById("stock-error").style.display = "none";

    document.getElementById("stock-modal").style.display = "flex";
}

function updateStockModalLabels() {
    const actionType = document.querySelector('input[name="stock-action-type"]:checked').value;
    const amountLabel = document.getElementById("stock-amount-label");
    const reasonInput = document.getElementById("stock-reason");
    const submitBtn = document.getElementById("stock-submit-btn");

    if (actionType === "add") {
        amountLabel.innerText = "Quantity to Add *";
        reasonInput.placeholder = "e.g. Supplier delivery";
        submitBtn.innerText = "Add Stock";
        submitBtn.className = "btn btn-primary";
    } else {
        amountLabel.innerText = "Quantity to Remove *";
        reasonInput.placeholder = "e.g. Damaged bottle or Expired pack";
        submitBtn.innerText = "Remove Stock";
        submitBtn.className = "btn btn-danger";
    }
}

function closeStockModal() {
    document.getElementById("stock-modal").style.display = "none";
}

function handleStockFormSubmit(event) {
    event.preventDefault();

    const productId = document.getElementById("stock-product-id").value;
    const actionType = document.querySelector('input[name="stock-action-type"]:checked').value;
    const amountValue = parseInt(document.getElementById("stock-amount").value, 10);
    const reasonValue = document.getElementById("stock-reason").value.trim();
    const errorBox = document.getElementById("stock-error");
    errorBox.style.display = "none";

    if (!amountValue || amountValue <= 0) {
        errorBox.style.display = "block";
        errorBox.innerText = "Quantity must be greater than zero.";
        return;
    }

    // Positive if adding, negative if removing
    const changeAmount = (actionType === "add") ? amountValue : -amountValue;

    fetch(`/api/products/${productId}/adjust-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            change_amount: changeAmount,
            reason: reasonValue
        })
    })
    .then(async response => {
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Failed to adjust stock.");
        }
        return data;
    })
    .then(() => {
        closeStockModal();
        loadProducts();
        loadDashboardReports();
    })
    .catch(error => {
        errorBox.style.display = "block";
        errorBox.innerText = error.message;
    });
}

// ------------------------------------------
// 7. Confirmation Modal (Archive & Unarchive)
// ------------------------------------------
function closeConfirmModal() {
    document.getElementById("confirm-modal").style.display = "none";
}

function archiveProduct(productId) {
    const product = currentProducts.find(p => p.id === productId);
    const productName = product ? product.name : "this product";

    document.getElementById("confirm-modal-title").innerText = "Archive Product";
    document.getElementById("confirm-modal-message").innerHTML = `
        Are you sure you want to archive <strong>${escapeHtml(productName)}</strong>?<br>
        <span style="font-size:0.85rem; color:var(--text-muted); display:inline-block; margin-top:0.4rem;">
            This will hide it from active stock while preserving all historical sales records.
        </span>
    `;

    const confirmBtn = document.getElementById("confirm-modal-btn");
    confirmBtn.className = "btn btn-danger";
    confirmBtn.innerText = "Yes, Archive";
    confirmBtn.onclick = function() {
        closeConfirmModal();
        executeArchive(productId);
    };

    document.getElementById("confirm-modal").style.display = "flex";
}

function executeArchive(productId) {
    fetch("/api/products/" + productId, { method: "DELETE" })
    .then(response => {
        if (!response.ok) throw new Error("Failed to archive product.");
        return response.json();
    })
    .then(() => {
        loadProducts();
    })
    .catch(error => {
        console.error("Archive error:", error);
        alert("Error archiving product: " + error.message);
    });
}

function unarchiveProduct(productId) {
    const product = currentProducts.find(p => p.id === productId);
    const productName = product ? product.name : "this product";

    document.getElementById("confirm-modal-title").innerText = "Unarchive Product";
    document.getElementById("confirm-modal-message").innerHTML = `
        Do you want to unarchive <strong>${escapeHtml(productName)}</strong>?<br>
        <span style="font-size:0.85rem; color:var(--text-muted); display:inline-block; margin-top:0.4rem;">
            This will restore it back into your active stock list.
        </span>
    `;

    const confirmBtn = document.getElementById("confirm-modal-btn");
    confirmBtn.className = "btn btn-primary";
    confirmBtn.innerText = "Yes, Unarchive";
    confirmBtn.onclick = function() {
        closeConfirmModal();
        executeUnarchive(productId);
    };

    document.getElementById("confirm-modal").style.display = "flex";
}

function executeUnarchive(productId) {
    fetch("/api/products/" + productId + "/unarchive", { method: "POST" })
    .then(response => {
        if (!response.ok) throw new Error("Failed to unarchive product.");
        return response.json();
    })
    .then(() => {
        loadProducts();
    })
    .catch(error => {
        console.error("Unarchive error:", error);
        alert("Error unarchiving product: " + error.message);
    });
}

function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// 9. Phase 4: Sales Management Logic
// ==========================================

let currentCart = [];
let selectedLookupProduct = null;
let isSubmittingSale = false;

// Populate the sales autocomplete datalist with active products
function populateSalesProductDatalist() {
    const datalist = document.getElementById("sales-products-datalist");
    if (!datalist) return;

    datalist.innerHTML = "";
    // Only suggest active products
    currentProducts.forEach(product => {
        if (product.is_active) {
            const option = document.createElement("option");
            option.value = product.code;
            option.label = `${product.name} (₹${product.selling_price} | Stock: ${product.stock_quantity} ${product.unit})`;
            datalist.appendChild(option);
        }
    });
}

// Live code lookup when typing in the sales product input
function handleSaleCodeLookup() {
    const input = document.getElementById("sale-code-input");
    const preview = document.getElementById("sale-lookup-preview");
    const addBtn = document.getElementById("sale-add-btn");
    const errorDiv = document.getElementById("sale-add-error");
    const qtyInput = document.getElementById("sale-qty-input");

    if (errorDiv) errorDiv.style.display = "none";
    if (!input) return;

    const query = input.value.trim().toUpperCase();
    if (!query) {
        selectedLookupProduct = null;
        if (preview) preview.style.display = "none";
        if (addBtn) addBtn.disabled = true;
        updateLineTotalPreview();
        return;
    }

    // Match by code first, then by exact name
    const found = currentProducts.find(p => p.is_active && (p.code.toUpperCase() === query || p.name.toUpperCase() === query));

    if (found) {
        selectedLookupProduct = found;
        document.getElementById("sale-preview-name").innerText = found.name;
        document.getElementById("sale-preview-price").innerText = `₹${found.selling_price.toFixed(2)} / ${found.unit}`;
        document.getElementById("sale-preview-code").innerText = found.code;
        document.getElementById("sale-preview-stock").innerText = `${found.stock_quantity} ${found.unit}(s)`;
        document.getElementById("sale-preview-cat").innerText = found.category;

        // Visual warning if stock is zero
        const stockEl = document.getElementById("sale-preview-stock");
        if (found.stock_quantity <= 0) {
            stockEl.style.color = "var(--danger-color)";
            stockEl.innerText += " (Out of stock!)";
            if (addBtn) addBtn.disabled = true;
        } else {
            stockEl.style.color = "inherit";
            if (addBtn) addBtn.disabled = false;
        }

        if (preview) preview.style.display = "block";
        updateLineTotalPreview();
    } else {
        selectedLookupProduct = null;
        if (preview) preview.style.display = "none";
        if (addBtn) addBtn.disabled = true;
        updateLineTotalPreview();
    }
}

// Update the line total preview box (Price * Qty)
function updateLineTotalPreview() {
    const lineTotalInput = document.getElementById("sale-line-total-preview");
    const qtyInput = document.getElementById("sale-qty-input");
    if (!lineTotalInput || !qtyInput) return;

    const qty = parseInt(qtyInput.value) || 0;
    if (selectedLookupProduct && qty > 0) {
        const total = selectedLookupProduct.selling_price * qty;
        lineTotalInput.value = `₹${total.toFixed(2)}`;
    } else {
        lineTotalInput.value = "₹0.00";
    }
}

// Add the selected product and quantity into the customer bill/cart
function handleAddItemToCart(event) {
    event.preventDefault();
    const errorDiv = document.getElementById("sale-add-error");
    const qtyInput = document.getElementById("sale-qty-input");
    const codeInput = document.getElementById("sale-code-input");
    const preview = document.getElementById("sale-lookup-preview");
    const addBtn = document.getElementById("sale-add-btn");

    if (errorDiv) errorDiv.style.display = "none";

    if (!selectedLookupProduct) {
        showSaleError("Please enter a valid product code first.");
        return;
    }

    const qty = parseInt(qtyInput.value);
    if (isNaN(qty) || qty <= 0) {
        showSaleError("Please enter a valid quantity of 1 or more.");
        return;
    }

    // Check existing quantity in current cart
    const existingIndex = currentCart.findIndex(item => item.product.id === selectedLookupProduct.id);
    const alreadyInCart = existingIndex >= 0 ? currentCart[existingIndex].quantity : 0;
    const totalDesired = alreadyInCart + qty;

    if (totalDesired > selectedLookupProduct.stock_quantity) {
        showSaleError(`Cannot add ${qty} more. Only ${selectedLookupProduct.stock_quantity} available in stock (${alreadyInCart} already in bill).`);
        return;
    }

    if (existingIndex >= 0) {
        currentCart[existingIndex].quantity += qty;
        currentCart[existingIndex].total_price = currentCart[existingIndex].quantity * selectedLookupProduct.selling_price;
    } else {
        currentCart.push({
            product: selectedLookupProduct,
            quantity: qty,
            total_price: qty * selectedLookupProduct.selling_price
        });
    }

    // Reset inputs
    codeInput.value = "";
    qtyInput.value = "1";
    selectedLookupProduct = null;
    if (preview) preview.style.display = "none";
    if (addBtn) addBtn.disabled = true;
    updateLineTotalPreview();

    renderCart();
    codeInput.focus();
}

function showSaleError(msg) {
    const errorDiv = document.getElementById("sale-add-error");
    if (errorDiv) {
        errorDiv.innerText = msg;
        errorDiv.style.display = "block";
    }
}

// Remove item from bill
function removeFromCart(index) {
    if (index >= 0 && index < currentCart.length) {
        currentCart.splice(index, 1);
        renderCart();
    }
}

// Clear the entire bill
function clearCart() {
    currentCart = [];
    renderCart();
}

// Render the cart / customer bill table and grand total
function renderCart() {
    const tableBody = document.getElementById("cart-table-body");
    const grandTotalEl = document.getElementById("bill-grand-total");
    const itemCountEl = document.getElementById("bill-item-count");
    const completeBtn = document.getElementById("complete-sale-btn");
    const clearBtn = document.getElementById("clear-cart-btn");

    if (!tableBody) return;

    if (currentCart.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
                    Your customer bill is empty.<br>
                    <span style="font-size: 0.85rem;">Enter product codes on the left to add items.</span>
                </td>
            </tr>
        `;
        if (grandTotalEl) grandTotalEl.innerText = "₹0.00";
        if (itemCountEl) itemCountEl.innerText = "0 items in bill";
        if (completeBtn) completeBtn.disabled = true;
        if (clearBtn) clearBtn.style.display = "none";
        return;
    }

    let grandTotal = 0;
    let totalItems = 0;
    let html = "";

    currentCart.forEach((item, index) => {
        grandTotal += item.total_price;
        totalItems += item.quantity;

        html += `
            <tr>
                <td><strong style="color:var(--primary-color);">${escapeHtml(item.product.code)}</strong></td>
                <td>${escapeHtml(item.product.name)}</td>
                <td>₹${item.product.selling_price.toFixed(2)}</td>
                <td><strong>${item.quantity}</strong> ${escapeHtml(item.product.unit)}</td>
                <td><strong>₹${item.total_price.toFixed(2)}</strong></td>
                <td style="text-align: center;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="removeFromCart(${index})" title="Remove item" style="padding: 0.2rem 0.5rem; color: var(--danger-color);">
                        &times;
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
    if (grandTotalEl) grandTotalEl.innerText = `₹${grandTotal.toFixed(2)}`;
    if (itemCountEl) itemCountEl.innerText = `${currentCart.length} product(s) (${totalItems} total units)`;
    if (completeBtn) completeBtn.disabled = false;
    if (clearBtn) clearBtn.style.display = "inline-block";
}

// Complete the sale and send to FastAPI
function completeSaleTransaction() {
    if (currentCart.length === 0 || isSubmittingSale) return;

    const completeBtn = document.getElementById("complete-sale-btn");
    isSubmittingSale = true;
    if (completeBtn) {
        completeBtn.disabled = true;
        completeBtn.innerText = "Recording Sale & Updating Stock...";
    }

    // Generate unique client idempotency token based on timestamp & random seed
    const clientSaleNumber = "REC-" + new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);

    const payload = {
        sale_number: clientSaleNumber,
        items: currentCart.map(item => ({
            product_code: item.product.code,
            quantity: item.quantity
        }))
    };

    fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(async response => {
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Failed to record sale");
        }
        return data;
    })
    .then(savedSale => {
        // Show success alert banner
        showSaleBanner(`Sale #${savedSale.sale_number} completed! Grand Total: ₹${savedSale.total_amount.toFixed(2)} — Stock automatically deducted.`, "success");
        
        // Clear bill
        currentCart = [];
        renderCart();

        // Reload products so stock is updated across all tables & datalists
        loadProducts();

        // Refresh recent sales table and dashboard recap
        loadSalesHistory();
        loadDashboardReports();

        // Display receipt modal for shopkeeper
        viewReceipt(savedSale);
    })
    .catch(error => {
        console.error("Sale error:", error);
        showSaleBanner(error.message, "error");
    })
    .finally(() => {
        isSubmittingSale = false;
        if (completeBtn) {
            completeBtn.disabled = currentCart.length === 0;
            completeBtn.innerText = "Complete Sale & Record Receipt";
        }
    });
}

function showSaleBanner(message, type) {
    const banner = document.getElementById("sale-alert-banner");
    if (!banner) return;

    banner.className = `sale-banner ${type}`;
    banner.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <button type="button" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:inherit;" onclick="this.parentElement.style.display='none'">&times;</button>
    `;
    banner.style.display = "flex";

    // Auto dismiss after 7 seconds
    setTimeout(() => {
        if (banner) banner.style.display = "none";
    }, 7000);
}

// Load past sales history
function loadSalesHistory() {
    const tbody = document.getElementById("sales-history-table-body");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Loading sales...</td></tr>`;

    fetch("/api/sales")
        .then(response => {
            if (!response.ok) throw new Error("Failed to load sales");
            return response.json();
        })
        .then(sales => {
            if (sales.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No sales recorded yet. Complete your first checkout above!</td></tr>`;
                return;
            }

            let rows = "";
            sales.forEach(sale => {
                const date = new Date(sale.created_at);
                const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // Summarize items
                const itemSummary = sale.items.map(it => `${it.product_name} (${it.quantity})`).join(", ");

                rows += `
                    <tr>
                        <td><strong style="color:var(--primary-color);">${escapeHtml(sale.sale_number)}</strong></td>
                        <td style="color:var(--text-muted); font-size:0.88rem;">${dateStr}</td>
                        <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(itemSummary)}">
                            ${escapeHtml(itemSummary)}
                        </td>
                        <td><strong style="color:var(--success);">₹${sale.total_amount.toFixed(2)}</strong></td>
                        <td style="text-align: center;">
                            <button class="btn btn-secondary btn-sm" onclick="viewReceiptById(${sale.id})">
                                View Receipt
                            </button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = rows;
        })
        .catch(err => {
            console.error("Sales history error:", err);
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger-color); padding: 1.5rem;">Error loading sales history.</td></tr>`;
        });
}

// View receipt modal
function viewReceiptById(saleId) {
    fetch("/api/sales/" + saleId)
        .then(res => res.json())
        .then(sale => viewReceipt(sale))
        .catch(err => alert("Could not fetch receipt: " + err.message));
}

function viewReceipt(sale) {
    const modal = document.getElementById("receipt-modal");
    const container = document.getElementById("receipt-modal-content");
    if (!modal || !container) return;

    const date = new Date(sale.created_at);
    const dateFormatted = date.toLocaleDateString() + " " + date.toLocaleTimeString();

    let itemsHtml = "";
    sale.items.forEach(item => {
        itemsHtml += `
            <tr>
                <td>${escapeHtml(item.product_name)} <span style="color:var(--text-muted); font-size:0.75rem;">(${escapeHtml(item.product_code)})</span></td>
                <td style="text-align:center;">${item.quantity}</td>
                <td style="text-align:right;">₹${item.unit_price.toFixed(2)}</td>
                <td style="text-align:right; font-weight:600;">₹${item.total_price.toFixed(2)}</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div class="receipt-header">
            <h4>AI-Powered Smart Shop</h4>
            <p>Customer Sale Receipt</p>
            <p><strong>Receipt #:</strong> ${escapeHtml(sale.sale_number)}</p>
            <p><strong>Date & Time:</strong> ${dateFormatted}</p>
        </div>
        <table class="receipt-items-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th style="text-align:center;">Qty</th>
                    <th style="text-align:right;">Price</th>
                    <th style="text-align:right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>
        <div class="receipt-total-box">
            <span>Grand Total:</span>
            <span style="color:var(--primary-color);">₹${sale.total_amount.toFixed(2)}</span>
        </div>
        <div style="text-align:center; font-size:0.78rem; color:var(--text-muted); margin-top:1rem;">
            Thank you for shopping with us!
        </div>
    `;

    modal.style.display = "flex";
}

function closeReceiptModal() {
    const modal = document.getElementById("receipt-modal");
    if (modal) modal.style.display = "none";
}

function printReceiptContent() {
    window.print();
}

// ------------------------------------------
// 7B. Integrated AI Chatbot Logic
// ------------------------------------------
let aiChatHistory = [];

function toggleAiChatWindow() {
    const popup = document.getElementById("ai-chat-popup");
    if (!popup) return;
    const isVisible = popup.style.display === "flex";
    if (isVisible) {
        popup.style.display = "none";
    } else {
        popup.style.display = "flex";
        const input = document.getElementById("ai-chat-input");
        if (input) input.focus();
    }
}

function sendQuickPrompt(promptText) {
    const popup = document.getElementById("ai-chat-popup");
    if (popup && popup.style.display !== "flex") {
        popup.style.display = "flex";
    }
    const input = document.getElementById("ai-chat-input");
    if (!input) return;
    input.value = promptText;
    handleSendAiMessage();
}

function clearAiChat() {
    aiChatHistory = [];
    const container = document.getElementById("ai-chat-messages");
    if (!container) return;
    container.innerHTML = `
        <div class="chat-message bot">
            <div class="chat-bubble">
                <p>Hello! I am your <strong>AI Store Assistant</strong>.</p>
                <p style="margin-top: 0.35rem; font-size: 0.85rem; color: var(--text-muted);">Ask any question about sales, inventory, profits, or products.</p>
            </div>
        </div>
    `;
}

function handleSendAiMessage(event) {
    if (event) event.preventDefault();

    const input = document.getElementById("ai-chat-input");
    const container = document.getElementById("ai-chat-messages");
    const submitBtn = document.getElementById("ai-chat-submit-btn");
    if (!input || !container) return;

    const query = input.value.trim();
    if (!query) return;

    // 1. Append user message to UI
    const userMsgDiv = document.createElement("div");
    userMsgDiv.className = "chat-message user";
    userMsgDiv.innerHTML = `
        <div class="chat-bubble">
            <p>${escapeHtml(query)}</p>
        </div>
    `;
    container.appendChild(userMsgDiv);

    // Clear input
    input.value = "";
    input.focus();

    // 2. Add typing indicator
    const typingDiv = document.createElement("div");
    typingDiv.className = "chat-message bot";
    typingDiv.id = "ai-typing-indicator";
    typingDiv.innerHTML = `
        <div class="chat-bubble">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;

    if (submitBtn) submitBtn.disabled = true;

    // Record in history
    aiChatHistory.push({ role: "user", content: query });

    // 3. Send request to backend
    fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: query,
            history: aiChatHistory.slice(-6)
        })
    })
    .then(async response => {
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "AI response error");
        }
        return data;
    })
    .then(data => {
        // Remove typing indicator
        const typingEl = document.getElementById("ai-typing-indicator");
        if (typingEl) typingEl.remove();

        // Format reply text (markdown bold, lists, newlines)
        const formattedReply = formatAiReply(data.reply);

        // Build actions HTML if any
        let actionsHtml = "";
        if (data.actions && data.actions.length > 0) {
            actionsHtml = `<div class="chat-actions">`;
            data.actions.forEach(action => {
                if (action.type === "restock" && action.product_id) {
                    actionsHtml += `
                        <button type="button" class="chat-action-btn" onclick="quickRestockFromDashboard(${action.product_id})">
                            ${escapeHtml(action.label || 'Restock')}
                        </button>
                    `;
                } else if (action.type === "view_receipt" && action.receipt_id) {
                    actionsHtml += `
                        <button type="button" class="chat-action-btn" onclick="viewReceiptById(${action.receipt_id})">
                            ${escapeHtml(action.label || 'View Receipt')}
                        </button>
                    `;
                }
            });
            actionsHtml += `</div>`;
        }

        // Append bot message to UI
        const botMsgDiv = document.createElement("div");
        botMsgDiv.className = "chat-message bot";
        botMsgDiv.innerHTML = `
            <div class="chat-bubble">
                ${formattedReply}
                ${actionsHtml}
            </div>
        `;
        container.appendChild(botMsgDiv);
        container.scrollTop = container.scrollHeight;

        aiChatHistory.push({ role: "assistant", content: data.reply });
    })
    .catch(error => {
        console.error("AI chat error:", error);
        const typingEl = document.getElementById("ai-typing-indicator");
        if (typingEl) typingEl.remove();

        const errorDiv = document.createElement("div");
        errorDiv.className = "chat-message bot";
        errorDiv.innerHTML = `
            <div class="chat-bubble" style="color: var(--danger-color);">
                <p>Sorry, I encountered an error connecting to the store service: ${escapeHtml(error.message)}</p>
            </div>
        `;
        container.appendChild(errorDiv);
        container.scrollTop = container.scrollHeight;
    })
    .finally(() => {
        if (submitBtn) submitBtn.disabled = false;
    });
}

function formatAiReply(text) {
    if (!text) return "";
    let formatted = escapeHtml(text);
    
    // Bold: **text**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Code / tags: `text`
    formatted = formatted.replace(/`([^`]+)`/g, "<code class='code-tag'>$1</code>");
    
    // Bullet points: • or * 
    const lines = formatted.split("\n");
    let inList = false;
    let result = "";

    for (let line of lines) {
        let trimmed = line.trim();
        if (trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
            if (!inList) {
                result += "<ul style='margin: 0.35rem 0 0.35rem 1.25rem; padding: 0;'>";
                inList = true;
            }
            result += `<li>${trimmed.substring(2)}</li>`;
        } else {
            if (inList) {
                result += "</ul>";
                inList = false;
            }
            if (trimmed === "") {
                result += "<div style='height: 0.35rem;'></div>";
            } else {
                result += `<p>${trimmed}</p>`;
            }
        }
    }
    if (inList) result += "</ul>";

    return result;
}

// ------------------------------------------
// 8. Page Load Initialization
// ------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    loadGeminiConfig();
    loadDashboardReports();
    loadProducts().then(() => {
        populateSalesProductDatalist();
    });
    loadSalesHistory();
});

