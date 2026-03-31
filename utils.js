// utils.js
// Helper: show toast message
function showToast(message, type = 'error') {
    const toastDiv = document.createElement('div');
    toastDiv.className = `fixed top-5 right-5 z-50 px-5 py-3 rounded-lg shadow-lg text-white font-medium transition-all duration-300 ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`;
    toastDiv.innerText = message;
    document.body.appendChild(toastDiv);
    setTimeout(() => toastDiv.remove(), 3500);
}

// Export to Excel (using SheetJS)
function exportToExcel(data, filename) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, filename);
    showToast(`Exported ${filename}`, "success");
}

// Logout function (redirect to login)
async function logoutAndRedirect() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

// Check authentication and redirect if not logged in
async function requireAuth(allowedRoles = ['user', 'admin']) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
    if (error || !profile) {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
        return null;
    }
    if (!profile.approved && profile.role !== 'admin') {
        showToast("Your account is pending approval.", "error");
        await supabase.auth.signOut();
        window.location.href = 'index.html';
        return null;
    }
    if (!allowedRoles.includes(profile.role)) {
        window.location.href = profile.role === 'admin' ? 'admin-dashboard.html' : 'user-dashboard.html';
        return null;
    }
    return { session, profile };
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}