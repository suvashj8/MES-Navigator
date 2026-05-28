/** Apply supervisor department lock; admin/operator use optional query filter. */
export function resolveDepartment(req, queryDepartment) {
  if (req.user.role === 'supervisor' && req.user.department) {
    return { department: req.user.department, locked: true };
  }
  return {
    department: queryDepartment || null,
    locked: false,
  };
}

export function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    display_name: row.display_name,
    department: row.department || null,
    is_active: row.is_active,
  };
}
