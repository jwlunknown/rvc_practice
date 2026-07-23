export function ghostThrow(ppr=6){
  const target=Math.max(0,Math.min(12,Number(ppr)||6)),bags=[],icons=[];
  for(let i=0;i<4;i++){
    const r=Math.random(),inChance=Math.min(.95,target/12*.75),onChance=Math.min(.45,(target/12)*.3);
    if(r<inChance){bags.push(3);icons.push('🕳️')}else if(r<inChance+onChance){bags.push(1);icons.push('🟨')}else{bags.push(0);icons.push('❌')}
  }
  return {bags,icons};
}
