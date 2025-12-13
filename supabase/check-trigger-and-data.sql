-- Check if trigger was created
SELECT tgname, tgtype, tgenabled 
FROM pg_trigger 
WHERE tgname = 'sync_investigator_ids_trigger';

-- Check current case data
SELECT 
    id,
    title,
    status,
    investigator_id,
    assigned_investigator_id,
    CASE 
        WHEN investigator_id IS NOT NULL OR assigned_investigator_id IS NOT NULL 
        THEN 'Has investigator'
        ELSE 'No investigator'
    END as investigator_status
FROM cases
WHERE title = 'põltsamaa';
