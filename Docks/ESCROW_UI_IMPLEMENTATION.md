# ESCROW System - UI Flow & Implementation Guide

## 🎨 UI Components Flow

### 1. Case Detail - Resolution Approval (Submitter View)

When case status = `RESOLVED`:

```tsx
// CaseDetail.tsx - Add resolution approval section
{isSubmitter && caseData.status === 'PENDING_REVIEW' && (
  <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-6 mt-6">
    <div className="flex items-center gap-2 mb-3 text-purple-300 font-bold">
      <AlertCircle className="w-5 h-5" /> Action Required
    </div>
    <p className="text-sm text-gray-300 mb-2">
      Your investigator has submitted a resolution. Please review their findings above.
    </p>
    <p className="text-sm text-green-400 mb-4">
      €{caseData.reward} is held in escrow and will be released upon your approval.
    </p>
    
    <div className="flex gap-3">
      <button 
        onClick={() => handleApproveResolution()}
        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg"
      >
        ✅ Accept Resolution & Release Funds
      </button>
      <button 
        onClick={() => handleRejectResolution()}
        className="px-4 py-2 bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-200 rounded-lg"
      >
        ❌ Reject & Escalate to Admin
      </button>
    </div>
    
    <p className="text-xs text-gray-500 mt-3">
      By accepting, €{(caseData.reward * 0.85).toFixed(2)} will be paid to the investigator 
      (platform fee: €{(caseData.reward * 0.15).toFixed(2)})
    </p>
  </div>
)}
```

### 2. Dispute Modal (Submitter Rejection)

```tsx
// RejectResolutionModal.tsx
export const RejectResolutionModal: React.FC<Props> = ({ caseId, onClose }) => {
  const [reason, setReason] = useState('');
  
  const handleSubmit = async () => {
    const { data, error } = await supabase.rpc('reject_resolution_escalate_admin', {
      p_case_id: caseId,
      p_rejected_by: user.id,
      p_rejection_reason: reason
    });
    
    if (!error) {
      alert('Case escalated to admin review. Funds remain in escrow.');
      onClose();
    }
  };
  
  return (
    <div className="modal">
      <h2>Reject Resolution</h2>
      <p>Please explain why you're rejecting this resolution:</p>
      <textarea 
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="The investigator did not address..."
        rows={5}
      />
      <button onClick={handleSubmit}>Submit to Admin Review</button>
    </div>
  );
};
```

### 3. Admin Dashboard - Dispute Resolution

```tsx
// AdminDashboard.tsx - Add disputes section
const [disputes, setDisputes] = useState([]);

useEffect(() => {
  // Fetch disputed cases
  const fetchDisputes = async () => {
    const { data } = await supabase
      .from('cases')
      .select(`
        *,
        submitter:profiles!submitted_by_id(*),
        investigator:profiles!assigned_investigator_id(*)
      `)
      .eq('status', 'DISPUTED')
      .order('updated_at', { ascending: false });
    setDisputes(data);
  };
  fetchDisputes();
}, []);

return (
  <div className="disputes-section">
    <h2>⚠️ Disputes Requiring Admin Review</h2>
    {disputes.map(dispute => (
      <div key={dispute.id} className="dispute-card">
        <h3>{dispute.title}</h3>
        <p>Submitter: {dispute.submitter.username}</p>
        <p>Investigator: {dispute.investigator.username}</p>
        <p>Escrow: €{dispute.reward}</p>
        <p>Reason: {dispute.metadata.rejection_reason}</p>
        
        <div className="actions">
          <button onClick={() => adminApprove(dispute.id)}>
            ✅ Approve (Release to Investigator)
          </button>
          <button onClick={() => adminRefund(dispute.id)}>
            ❌ Refund Submitter (-50 rep to investigator)
          </button>
          <button onClick={() => sendToVote(dispute.id)}>
            🗳️ Community Vote (7 days)
          </button>
        </div>
      </div>
    ))}
  </div>
);

// Admin action handlers
const adminApprove = async (caseId: string) => {
  const notes = prompt('Admin notes (optional):');
  const { data } = await supabase.rpc('admin_resolve_dispute_release', {
    p_case_id: caseId,
    p_admin_id: user.id,
    p_admin_notes: notes
  });
  if (data.success) alert('Funds released to investigator!');
};

const adminRefund = async (caseId: string) => {
  if (!confirm('This will refund submitter and penalize investigator. Continue?')) return;
  const notes = prompt('Admin notes (required):');
  const { data } = await supabase.rpc('admin_resolve_dispute_refund', {
    p_case_id: caseId,
    p_admin_id: user.id,
    p_admin_notes: notes
  });
  if (data.success) {
    alert(`Refunded €${data.refund_amount}. Investigator reputation reduced.`);
  }
};

const sendToVote = async (caseId: string) => {
  const { data } = await supabase.rpc('send_case_to_community_vote', {
    p_case_id: caseId,
    p_admin_id: user.id,
    p_voting_duration_days: 7
  });
  if (data.success) {
    alert('Case sent to community voting. Ends: ' + data.voting_ends_at);
  }
};
```

### 4. Community Voting Interface

```tsx
// CaseDetail.tsx - Add voting section
{caseData.status === 'VOTING' && (
  <div className="bg-mystery-800 rounded-xl border border-red-500/50 p-6 mt-6">
    <h3 className="font-bold text-white mb-2 flex items-center gap-2">
      <Scale className="text-red-400" /> Community Tribunal In Session
    </h3>
    <p className="text-gray-300 text-sm mb-4">
      This case is under dispute. The community will vote to determine if 
      the resolution is valid and if funds (€{caseData.reward}) should be released.
    </p>
    
    <div className="grid grid-cols-2 gap-4 mb-4">
      <button 
        onClick={() => handleVote('investigator')}
        className="p-4 bg-green-900/20 hover:bg-green-900/40 border border-green-500/30 rounded-lg"
      >
        <ThumbsUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <span className="font-bold text-white">Approve Resolution</span>
        <span className="text-sm text-gray-400 block mt-1">
          {caseData.metadata.votes_for_investigator || 0} votes
        </span>
      </button>
      
      <button 
        onClick={() => handleVote('refund')}
        className="p-4 bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 rounded-lg"
      >
        <ThumbsDown className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <span className="font-bold text-white">Refund Submitter</span>
        <span className="text-sm text-gray-400 block mt-1">
          {caseData.metadata.votes_for_refund || 0} votes
        </span>
      </button>
    </div>
    
    <p className="text-xs text-gray-500">
      Voting ends: {new Date(caseData.metadata.voting_ends_at).toLocaleString()}
    </p>
    <p className="text-xs text-yellow-400 mt-2">
      ⏱️ Escrow (€{caseData.reward}) held until voting concludes
    </p>
  </div>
)}

// Vote handler
const handleVote = async (voteFor: 'investigator' | 'refund') => {
  const { data, error } = await supabase.rpc('cast_community_vote', {
    p_case_id: caseData.id,
    p_voter_id: user.id,
    p_vote_for: voteFor
  });
  
  if (error) {
    alert(error.message);
  } else {
    alert('Vote recorded!');
    // Refresh case data
  }
};
```

## 📊 Escrow Status Indicators

### Add to Case Card/List
```tsx
// Show escrow badge on case cards
{caseData.status === 'RESOLVED' && (
  <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">
    💰 €{caseData.reward} in Escrow
  </span>
)}

{caseData.status === 'DISPUTED' && (
  <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded">
    ⚠️ Disputed - Admin Review
  </span>
)}

{caseData.status === 'VOTING' && (
  <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
    🗳️ Community Voting
  </span>
)}
```

## 🔔 Notifications System

### Email/Push Notifications
```typescript
// notifications.ts
export const sendNotification = async (type: string, data: any) => {
  switch(type) {
    case 'resolution_submitted':
      // To submitter: "Your investigator submitted a resolution. Review now!"
      break;
    case 'resolution_approved':
      // To investigator: "Funds released! €X added to wallet"
      break;
    case 'resolution_rejected':
      // To investigator: "Resolution rejected. Case under admin review."
      // To admin: "New dispute requires your attention"
      break;
    case 'voting_started':
      // To community: "New case voting started!"
      break;
    case 'voting_ended':
      // To parties: "Voting concluded. Decision: ..."
      break;
  }
};
```

## 🧪 Testing Checklist

- [ ] Donate to case → Check escrow held in platform wallet
- [ ] Resolve case → Check submitter sees approval UI
- [ ] Approve resolution → Check funds released to investigator
- [ ] Reject resolution → Check case goes to DISPUTED
- [ ] Admin approve dispute → Check funds released
- [ ] Admin refund dispute → Check refund + investigator penalty
- [ ] Send to community vote → Check voting UI appears
- [ ] Cast votes → Check vote counts update
- [ ] Finalize vote → Check correct decision executed
- [ ] Check escrow balance matches sum of held transactions

---

Koostatud: 2025-12-05
ESCROW System for Unexplained Archive
