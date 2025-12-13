SELECT 
    c.id,
    c.title,
    c.status,
    c.investigator_id,
    c.assigned_investigator_id,
    p.username as investigator_name
FROM cases c
LEFT JOIN profiles p ON c.investigator_id = p.id OR c.assigned_investigator_id = p.id
WHERE c.title = 'põltsamaa';
