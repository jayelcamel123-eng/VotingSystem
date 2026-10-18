async function submitVoterBallot(){
 const voter=currentLoggedVoter();const data=currentBallotData;
 if(!voter||!data?.election)return alert('No active ballot is available.');
 const groups=[...new Set((data.candidates||[]).filter(c=>!(String(c.position_name).toLowerCase()==='grade representative'&&Number(c.grade)!==Number(voter.grade))).map(c=>Number(c.position_id)))];
 const selections=[];
 for(const positionId of groups){const checked=document.querySelector(`input[name="position_${positionId}"]:checked`);if(!checked)return alert('Please select a candidate for every position.');selections.push({position_id:positionId,candidate_id:Number(checked.value)});}
 if(!confirm('Are you sure you want to submit your ballot? You cannot change it after submission.'))return;
 const payload={voter_id:voter.voter_id,election_id:Number(data.election.election_id),selections};
 if(!navigator.onLine){
   const pending=JSON.parse(localStorage.getItem('offlineVotes')||'[]');
   if(pending.some(v=>v.voter_id===voter.voter_id&&v.election_id===payload.election_id))return alert('A pending offline ballot already exists for this voter.');
   pending.push({...payload,queued_at:new Date().toISOString()});localStorage.setItem('offlineVotes',JSON.stringify(pending));
   voter.voting_status='voted';localStorage.setItem('currentVoter',JSON.stringify(voter));
   alert('You are offline. Your ballot has been saved on this device and will be synchronized when the connection returns.');closeVoterBallot();return;
 }
 try{const result=await apiJson('/votes/cast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});voter.voting_status='voted';localStorage.setItem('currentVoter',JSON.stringify(voter));alert(result.message||'Vote submitted successfully!');closeVoterBallot();await loadVoterDashboard();}catch(e){alert(`Vote was not submitted.\n\n${e.message}`);}
}

async function syncOfflineVotes(){
 if(!navigator.onLine)return;
 const pending=JSON.parse(localStorage.getItem('offlineVotes')||'[]');if(!pending.length)return;
 const remaining=[];let synced=0;
 for(const vote of pending){try{await apiJson('/votes/cast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(vote)});synced++;}catch(e){console.warn('Offline vote sync failed:',e.message);remaining.push(vote);}}
 localStorage.setItem('offlineVotes',JSON.stringify(remaining));
 if(synced)alert(`${synced} offline ballot(s) synchronized successfully.`);
}
