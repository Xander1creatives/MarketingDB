// app.js - Full application logic (auth, dashboards, clients, analytics, export)

// ------------------------ GLOBAL STATE ---------------------------------
let currentSession = null;      // supabase session user
let currentProfile = null;       // { id, email, role, approved, full_name, avatar_url }
let currentView = 'login';       // login, signup, forgot, user-dashboard, admin-dashboard
let statusChart = null;          // Chart.js instance

const appRoot = document.getElementById('app');

// Helper: show toast message
function showToast(message, type = 'error') {
    const toastDiv = document.createElement('div');
    toastDiv.className = `fixed top-5 right-5 z-50 px-5 py-3 rounded-lg shadow-lg text-white font-medium transition-all duration-300 ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`;
    toastDiv.innerText = message;
    document.body.appendChild(toastDiv);
    setTimeout(() => { toastDiv.remove(); }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Export to Excel
function exportToExcel(data, filename) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, filename);
    showToast(`Exported ${filename}`, "success");
}

// ======================= AUTH & ROUTING ================================
async function checkAuthAndRender() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        currentSession = null;
        currentProfile = null;
        renderLoginView();
        return;
    }
    currentSession = session;
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
    if (error || !profile) {
        await supabase.auth.signOut();
        renderLoginView();
        showToast("Profile error, please login again");
        return;
    }
    if (profile.role !== 'admin' && !profile.approved) {
        await supabase.auth.signOut();
        renderLoginView();
        showToast("Your account is pending admin approval. Please wait.", "error");
        return;
    }
    currentProfile = profile;
    if (profile.role === 'admin') {
        renderAdminDashboard();
    } else {
        renderUserDashboard();
    }
}

async function logoutUser() {
    await supabase.auth.signOut();
    currentSession = null;
    currentProfile = null;
    renderLoginView();
    showToast("Logged out successfully", "success");
}

// ======================= LOGIN, SIGNUP, FORGOT PASSWORD ===============
function renderLoginView() {
    appRoot.innerHTML = `
        <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
                <div class="text-center mb-6">
                    <i class="fas fa-chart-line text-4xl text-indigo-600"></i>
                    <h2 class="text-3xl font-bold mt-2 text-gray-800">MarketPulse CRM</h2>
                    <p class="text-gray-500">Sign in to your account</p>
                </div>
                <form id="loginForm">
                    <div class="mb-4">
                        <label class="block text-gray-700 text-sm font-bold mb-2">Email</label>
                        <input type="email" id="loginEmail" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400" required>
                    </div>
                    <div class="mb-6">
                        <label class="block text-gray-700 text-sm font-bold mb-2">Password</label>
                        <input type="password" id="loginPassword" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400" required>
                    </div>
                    <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition">Login</button>
                </form>
                <div class="mt-4 text-center text-sm">
                    <a href="#" id="forgotLink" class="text-indigo-600 hover:underline">Forgot password?</a>
                    <span class="mx-2">|</span>
                    <a href="#" id="signupLink" class="text-indigo-600 hover:underline">Create new account</a>
                </div>
            </div>
        </div>
    `;
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { showToast(error.message); return; }
        await checkAuthAndRender();
    });
    document.getElementById('forgotLink').addEventListener('click', (e) => { e.preventDefault(); renderForgotView(); });
    document.getElementById('signupLink').addEventListener('click', (e) => { e.preventDefault(); renderSignupView(); });
}

function renderSignupView() {
    appRoot.innerHTML = `
        <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-teal-100 p-4">
            <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
                <h2 class="text-3xl font-bold text-center text-gray-800">Register</h2>
                <form id="signupForm" class="mt-6">
                    <div class="mb-3"><label class="block text-sm font-medium">Full Name</label><input type="text" id="fullName" class="w-full border rounded-lg p-2" required></div>
                    <div class="mb-3"><label class="block text-sm font-medium">Email</label><input type="email" id="signupEmail" class="w-full border rounded-lg p-2" required></div>
                    <div class="mb-3"><label class="block text-sm font-medium">Password</label><input type="password" id="signupPassword" class="w-full border rounded-lg p-2" required></div>
                    <button type="submit" class="w-full bg-teal-600 text-white py-2 rounded-lg hover:bg-teal-700">Sign Up</button>
                </form>
                <p class="text-center text-sm mt-4">Already have an account? <a href="#" id="gotoLogin" class="text-teal-600">Login</a></p>
            </div>
        </div>
    `;
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const fullName = document.getElementById('fullName').value;
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) { showToast(error.message); return; }
        if (data.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{ id: data.user.id, email, full_name: fullName, role: 'user', approved: false, avatar_url: null }]);
            if (profileError) console.error(profileError);
            showToast("Registration successful! Wait for admin approval.", "success");
            renderLoginView();
        }
    });
    document.getElementById('gotoLogin').addEventListener('click', (e) => { e.preventDefault(); renderLoginView(); });
}

function renderForgotView() {
    appRoot.innerHTML = `
        <div class="flex min-h-screen items-center justify-center bg-gray-100 p-4">
            <div class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
                <h2 class="text-2xl font-bold">Reset Password</h2>
                <form id="resetForm" class="mt-4">
                    <input type="email" id="resetEmail" placeholder="Your email" class="w-full border p-2 rounded mb-4" required>
                    <button type="submit" class="bg-indigo-600 text-white w-full py-2 rounded">Send reset link</button>
                </form>
                <a href="#" id="backLogin" class="text-sm text-indigo-500 mt-3 inline-block">Back to Login</a>
            </div>
        </div>
    `;
    document.getElementById('resetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value;
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) showToast(error.message);
        else showToast("Password reset email sent!", "success");
    });
    document.getElementById('backLogin').addEventListener('click', (e) => { e.preventDefault(); renderLoginView(); });
}

// ======================= USER DASHBOARD =================================
async function renderUserDashboard() {
    if (!currentProfile) return;
    const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', currentProfile.id)
        .order('created_at', { ascending: false });
    if (error) console.error(error);
    const userClients = clients || [];
    const activeCount = userClients.filter(c => c.status === 'active').length;
    const dormantCount = userClients.filter(c => c.status === 'dormant').length;
    const topReliable = [...userClients].sort((a,b) => (b.reliability_score || 0) - (a.reliability_score || 0)).slice(0,10);
    
    appRoot.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 py-6">
            <div class="bg-white rounded-xl shadow-md p-5 flex flex-wrap justify-between items-center mb-6">
                <div class="flex items-center gap-4">
                    <div class="relative">
                        <img id="identityAvatar" src="${currentProfile.avatar_url || 'https://via.placeholder.com/64?text=User'}" class="w-16 h-16 rounded-full object-cover border-2 border-indigo-300">
                        <label for="avatarUpload" class="absolute bottom-0 right-0 bg-indigo-600 rounded-full p-1 cursor-pointer text-white text-xs"><i class="fas fa-camera"></i></label>
                        <input type="file" id="avatarUpload" accept="image/*" class="hidden">
                    </div>
                    <div><h2 class="text-xl font-bold">${currentProfile.full_name || 'User'}</h2><p class="text-gray-500">${currentProfile.email}</p><span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">${currentProfile.role}</span></div>
                </div>
                <button id="logoutBtnUser" class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"><i class="fas fa-sign-out-alt"></i> Logout</button>
            </div>
            
            <div class="flex flex-wrap justify-between items-center mb-5">
                <button id="openAddClientModal" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg shadow"><i class="fas fa-plus"></i> Add New Client</button>
                <button id="exportExcelBtn" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg shadow"><i class="fas fa-file-excel"></i> Export to Excel</button>
            </div>
            
            <div class="grid md:grid-cols-3 gap-5 mb-8">
                <div class="bg-white p-4 rounded-xl shadow-sm border-l-8 border-green-500"><p class="text-gray-500">Active Clients</p><p class="text-3xl font-bold">${activeCount}</p></div>
                <div class="bg-white p-4 rounded-xl shadow-sm border-l-8 border-orange-400"><p class="text-gray-500">Dormant Clients</p><p class="text-3xl font-bold">${dormantCount}</p></div>
                <div class="bg-white p-4 rounded-xl shadow-sm border-l-8 border-blue-500"><p class="text-gray-500">Total Clients</p><p class="text-3xl font-bold">${userClients.length}</p></div>
            </div>
            
            <div class="grid lg:grid-cols-2 gap-6 mb-8">
                <div class="bg-white p-4 rounded-xl shadow"><canvas id="statusPieChart" width="400" height="300"></canvas><p class="text-center text-sm font-medium mt-2">Client Status Distribution</p></div>
                <div class="bg-white p-4 rounded-xl shadow"><h3 class="font-bold text-lg mb-3">🏆 Top 10 Reliable Clients</h3><ul id="topReliableList" class="divide-y"></ul></div>
            </div>
            
            <div class="bg-white rounded-xl shadow overflow-hidden">
                <div class="overflow-x-auto scrollable-table"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-4 py-3">Company</th><th>Category</th><th>Status</th><th>Reliability</th><th>Contact</th><th>Actions</th></tr></thead><tbody id="clientsTableBody"></tbody></table></div>
            </div>
        </div>
        
        <div id="clientModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50"><div class="bg-white rounded-xl w-full max-w-md p-6"><h3 id="modalTitle" class="text-xl font-bold mb-3">Add Client</h3><form id="clientForm"><input type="hidden" id="clientId"><div class="mb-2"><label>Company Name</label><input id="compName" class="w-full border rounded p-2" required></div><div class="mb-2"><label>Category</label><select id="category" class="w-full border rounded p-2"><option>private</option><option>government</option><option>NGO</option></select></div><div class="mb-2"><label>Status</label><select id="status" class="w-full border rounded p-2"><option value="active">Active</option><option value="dormant">Dormant</option></select></div><div class="mb-2"><label>Reliability Score (0-100)</label><input id="reliability" type="number" min="0" max="100" value="50" class="w-full border rounded p-2"></div><div class="mb-2"><label>Contact Person</label><input id="contactPerson" class="w-full border rounded p-2"></div><div class="mb-2"><label>Email</label><input id="contactEmail" type="email" class="w-full border rounded p-2"></div><div class="mb-2"><label>Phone</label><input id="phone" class="w-full border rounded p-2"></div><div class="flex justify-end gap-2 mt-4"><button type="button" id="closeModal" class="px-4 py-2 bg-gray-300 rounded">Cancel</button><button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded">Save</button></div></form></div></div>
    `;
    
    // Populate clients table
    const tbody = document.getElementById('clientsTableBody');
    function renderTableRows() {
        if (!tbody) return;
        tbody.innerHTML = userClients.map(client => `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-2 font-medium">${escapeHtml(client.company_name)}</td>
                <td class="px-4 py-2 capitalize">${client.category}</td>
                <td class="px-4 py-2"><span class="status-badge ${client.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}"><i class="fas ${client.status === 'active' ? 'fa-check-circle' : 'fa-moon'}"></i> ${client.status}</span></td>
                <td class="px-4 py-2">${client.reliability_score || 50}</td>
                <td class="px-4 py-2">${client.contact_person || '-'}<br><small>${client.email || ''}</small></td>
                <td class="px-4 py-2"><button data-id="${client.id}" class="editClientBtn text-blue-600 mr-2"><i class="fas fa-edit"></i></button><button data-id="${client.id}" class="deleteClientBtn text-red-600"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');
        document.querySelectorAll('.editClientBtn').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
        document.querySelectorAll('.deleteClientBtn').forEach(btn => btn.addEventListener('click', async () => { if(confirm('Delete client?')) await deleteClient(btn.dataset.id); }));
    }
    renderTableRows();
    
    const reliableList = document.getElementById('topReliableList');
    if(reliableList) reliableList.innerHTML = topReliable.map((c,i) => `<li class="py-2 flex justify-between"><span>${i+1}. ${c.company_name}</span><span class="font-bold">⭐ ${c.reliability_score || 50}</span></li>`).join('');
    
    const ctx = document.getElementById('statusPieChart').getContext('2d');
    if(statusChart) statusChart.destroy();
    statusChart = new Chart(ctx, { type: 'pie', data: { labels: ['Active', 'Dormant'], datasets: [{ data: [activeCount, dormantCount], backgroundColor: ['#22c55e', '#f97316'] }] } });
    
    document.getElementById('exportExcelBtn').addEventListener('click', () => exportToExcel(userClients, 'my_clients.xlsx'));
    document.getElementById('logoutBtnUser').addEventListener('click', logoutUser);
    
    const modal = document.getElementById('clientModal');
    document.getElementById('openAddClientModal').addEventListener('click', () => { document.getElementById('modalTitle').innerText = 'Add Client'; document.getElementById('clientForm').reset(); document.getElementById('clientId').value = ''; modal.classList.remove('hidden'); modal.classList.add('flex'); });
    document.getElementById('closeModal').addEventListener('click', () => { modal.classList.add('hidden'); });
    document.getElementById('clientForm').addEventListener('submit', async (e) => { e.preventDefault(); await saveClient(); modal.classList.add('hidden'); await renderUserDashboard(); });
    
    const avatarInput = document.getElementById('avatarUpload');
    avatarInput.addEventListener('change', async (e) => { const file = e.target.files[0]; if(file) await uploadAvatar(file); });
    
    async function uploadAvatar(file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentProfile.id}_${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage.from('avatars').upload(fileName, file);
        if(error) { showToast(error.message); return; }
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentProfile.id);
        currentProfile.avatar_url = publicUrl;
        document.getElementById('identityAvatar').src = publicUrl;
        showToast("Avatar updated", "success");
    }
    
    async function saveClient() {
        const id = document.getElementById('clientId').value;
        const payload = {
            company_name: document.getElementById('compName').value,
            category: document.getElementById('category').value,
            status: document.getElementById('status').value,
            reliability_score: parseInt(document.getElementById('reliability').value) || 50,
            contact_person: document.getElementById('contactPerson').value,
            email: document.getElementById('contactEmail').value,
            phone: document.getElementById('phone').value,
            user_id: currentProfile.id,
        };
        if(id) { await supabase.from('clients').update(payload).eq('id', id); showToast("Client updated"); }
        else { await supabase.from('clients').insert(payload); showToast("Client added"); }
        await renderUserDashboard();
    }
    
    async function deleteClient(clientId) {
        await supabase.from('clients').delete().eq('id', clientId);
        showToast("Deleted", "success");
        await renderUserDashboard();
    }
    
    async function openEditModal(clientId) {
        const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single();
        if(client){
            document.getElementById('clientId').value = client.id;
            document.getElementById('compName').value = client.company_name;
            document.getElementById('category').value = client.category;
            document.getElementById('status').value = client.status;
            document.getElementById('reliability').value = client.reliability_score;
            document.getElementById('contactPerson').value = client.contact_person || '';
            document.getElementById('contactEmail').value = client.email || '';
            document.getElementById('phone').value = client.phone || '';
            document.getElementById('modalTitle').innerText = 'Edit Client';
            modal.classList.remove('hidden'); modal.classList.add('flex');
        }
    }
}

// ======================= ADMIN DASHBOARD ================================
async function renderAdminDashboard() {
    if(!currentProfile || currentProfile.role !== 'admin') return;
    const { data: allUsers } = await supabase.from('profiles').select('*').order('created_at');
    const { data: allClients } = await supabase.from('clients').select(`*, profiles!inner(email, full_name)`);
    
    appRoot.innerHTML = `
        <div class="max-w-7xl mx-auto p-5">
            <div class="bg-indigo-900 text-white p-4 rounded-xl flex justify-between items-center"><h1 class="text-2xl font-bold"><i class="fas fa-user-shield"></i> Admin Panel</h1><button id="adminLogout" class="bg-red-500 px-4 py-2 rounded">Logout</button></div>
            <div class="grid md:grid-cols-2 gap-5 my-6">
                <div class="bg-white shadow rounded p-4"><h2 class="font-bold text-lg">👥 User Approvals</h2><ul id="userApprovalList"></ul></div>
                <div class="bg-white shadow rounded p-4"><h2 class="font-bold text-lg">➕ Admin Action: Create Client (Own DB)</h2><button id="adminCreateClientBtn" class="bg-green-600 text-white px-4 py-2 rounded mt-2"><i class="fas fa-database"></i> Add New Client (as Admin)</button></div>
            </div>
            <div class="bg-white shadow rounded p-4 mb-6"><h2 class="font-bold text-xl">📋 All Clients (All Users & Organizations)</h2><button id="exportAllExcel" class="bg-emerald-600 text-white px-3 py-1 rounded float-right mb-2">Export All Excel</button><div class="overflow-x-auto"><table class="min-w-full"><thead><tr><th>Company</th><th>Category</th><th>Status</th><th>Owner (User)</th><th>Reliability</th><th>Actions</th></tr></thead><tbody id="adminClientsTable"></tbody></table></div></div>
        </div>
        <div id="adminClientModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center"><div class="bg-white p-6 rounded-xl w-full max-w-md"><h3 class="font-bold text-xl">Add Client (Admin)</h3><form id="adminClientForm"><input type="hidden" id="adminClientId"><div class="mb-2"><label>Company Name</label><input id="adminCompName" class="w-full border p-2"></div><div class="mb-2"><label>Category</label><select id="adminCategory"><option>private</option><option>government</option><option>NGO</option></select></div><div class="mb-2"><label>Status</label><select id="adminStatus"><option value="active">Active</option><option value="dormant">Dormant</option></select></div><div class="mb-2"><label>Reliability</label><input id="adminReliability" type="number" value="50"></div><div class="flex justify-end gap-2 mt-3"><button type="button" id="closeAdminModal" class="bg-gray-400 px-3 py-1 rounded">Cancel</button><button type="submit" class="bg-indigo-600 text-white px-3 py-1 rounded">Save</button></div></form></div></div>
    `;
    
    const userListDiv = document.getElementById('userApprovalList');
    if(userListDiv && allUsers){
        userListDiv.innerHTML = allUsers.map(u => `<li class="flex justify-between items-center border-b py-2"><span>${u.email} (${u.full_name || 'no name'}) - ${u.approved ? '✅ Approved' : '⏳ Pending'}</span> ${!u.approved ? `<button data-id="${u.id}" class="approveUserBtn bg-blue-500 text-white px-2 py-1 rounded text-xs">Approve</button>` : `<span class="text-green-600 text-xs">Active</span>`}</li>`).join('');
        document.querySelectorAll('.approveUserBtn').forEach(btn => btn.addEventListener('click', async (e) => { const userId = btn.dataset.id; await supabase.from('profiles').update({ approved: true }).eq('id', userId); showToast("User approved", "success"); renderAdminDashboard(); }));
    }
    
    const adminModal = document.getElementById('adminClientModal');
    document.getElementById('adminCreateClientBtn').addEventListener('click', () => { adminModal.classList.remove('hidden'); adminModal.classList.add('flex'); });
    document.getElementById('closeAdminModal').addEventListener('click', () => adminModal.classList.add('hidden'));
    document.getElementById('adminClientForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newClient = {
            company_name: document.getElementById('adminCompName').value,
            category: document.getElementById('adminCategory').value,
            status: document.getElementById('adminStatus').value,
            reliability_score: parseInt(document.getElementById('adminReliability').value),
            user_id: currentProfile.id,
            contact_person: 'Admin',
            email: 'admin@system.local'
        };
        await supabase.from('clients').insert(newClient);
        showToast("Client created as admin", "success");
        adminModal.classList.add('hidden');
        renderAdminDashboard();
    });
    
    const adminTableBody = document.getElementById('adminClientsTable');
    if(allClients){
        adminTableBody.innerHTML = allClients.map(c => `<tr class="border-b"><td class="p-2">${c.company_name}</td><td>${c.category}</td><td><span class="status-badge ${c.status === 'active' ? 'bg-green-100' : 'bg-orange-100'}">${c.status}</span></td><td>${c.profiles?.email || 'unknown'}</td><td>${c.reliability_score || 50}</td><td><button data-id="${c.id}" class="adminDelClient text-red-600"><i class="fas fa-trash"></i></button></td></tr>`).join('');
        document.querySelectorAll('.adminDelClient').forEach(btn => btn.addEventListener('click', async (e) => { if(confirm('Delete client from any user?')){ await supabase.from('clients').delete().eq('id', btn.dataset.id); renderAdminDashboard(); } }));
    }
    document.getElementById('exportAllExcel').addEventListener('click', () => { if(allClients) exportToExcel(allClients.map(c => ({ ...c, owner_email: c.profiles?.email })), 'all_clients.xlsx'); });
    document.getElementById('adminLogout').addEventListener('click', logoutUser);
}

// Initialize app
window.addEventListener('DOMContentLoaded', async () => {
    await checkAuthAndRender();
});