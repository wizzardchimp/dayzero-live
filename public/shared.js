// Day Zero Live — Shared Game Data
// Single source of truth for attacks, defences, and constants.
// Used by server.js (via require), play.html, and dashboard.html.

(function(root){
const ATTACKS=[
  {id:'phishing',name:'Phishing',icon:'🎣',desc:'Deceptive emails to steal credentials',plain:'A fake message that tries to steal a password or get someone to click a bad link.',example:'An email from your "CEO" requests urgent gift card purchases'},
  {id:'malware',name:'Malware',icon:'🦠',desc:'Malicious software to compromise systems',plain:'Harmful software that gets onto a device and spies, damages, or takes control.',example:'An innocent-looking PDF attachment installs a keylogger'},
  {id:'ransomware',name:'Ransomware',icon:'🔒',desc:'Encrypts data and demands payment',plain:'Software that locks your files and demands money to give them back.',example:'All company files encrypted — pay 10 BTC within 48 hours'},
  {id:'ddos',name:'DDoS',icon:'🌊',desc:'Overwhelming traffic to disrupt services',plain:'So much fake traffic that a website or service falls over.',example:'A sudden flood of website requests overwhelmed the servers and shut customer contact down'},
  {id:'sql_injection',name:'SQL Injection',icon:'💉',desc:'Database manipulation via input fields',plain:'A trick that uses a login or search box to steal what is in the database.',example:'A hacker has exploited the customer login screen to dump the entire user database contents!'},
  {id:'zero_day',name:'Zero-Day Exploit',icon:'⚡',desc:'Attacking unknown vulnerabilities',plain:'An attack that uses a flaw nobody has patched yet.',example:'An unpatched router vulnerability gives attackers full network access'},
  {id:'insider',name:'Insider Threat',icon:'🏢',desc:'Malicious or negligent internal actors',plain:'Someone who already works there misusing their access.',example:'A departing employee copies the entire client database before leaving'},
  {id:'data_exfil',name:'Data Exfiltration',icon:'📤',desc:'Stealing sensitive data from systems',plain:'Sensitive files being copied out of the organisation.',example:'Sensitive spreadsheets are accidentally uploaded to a personal cloud account!'},
  {id:'social_eng',name:'Social Engineering',icon:'🎭',desc:'Psychological manipulation to gain access',plain:'Someone talked into giving access, often by a person pretending to be IT.',example:'Caller posing as IT support asks you to "verify" your password'}
];

const DEFENCES=[
  {id:'firewall',name:'Firewall',icon:'🛡️',desc:'Monitors and controls network traffic',plain:'A gate that checks what is allowed in and out of the network.',counters:['phishing','ddos']},
  {id:'endpoint',name:'Endpoint Protection',icon:'💻',desc:'Antivirus and protection on every laptop and phone',plain:'Antivirus for every laptop and phone. It blocks viruses and ransomware on the device itself.',counters:['malware','ransomware']},
  {id:'mfa',name:'Multi-Factor Auth',icon:'🔐',desc:'Requires multiple verification methods',plain:'An extra check, like a code or fingerprint, so a password alone is not enough.',counters:['social_eng']},
  {id:'encryption',name:'Encryption',icon:'🔒',desc:'Scrambles data to prevent unauthorised access',plain:'Scrambles data so stolen files cannot be read.',counters:['ransomware']},
  {id:'seg',name:'Network Segmentation',icon:'🔀',desc:'Separates the network into departmental areas',plain:'Splits the network so one break-in cannot reach everything.',counters:['sql_injection','insider']},
  {id:'backup',name:'Backup & Recovery',short:'Backup',icon:'🗄️',desc:'Restores data after loss or attack',plain:'A spare copy of files so you can recover after an attack.',counters:['ransomware','ddos']},
  {id:'threat',name:'Threat Detection',icon:'👁️',desc:'Spots attacks that are already under way across the network',plain:'An alarm for the whole network. It spots an attack that has already started, even one nobody has seen before.',counters:['zero_day','phishing']},
  {id:'passwords',name:'Secure Passwords',short:'Passwords',icon:'🔑',desc:'Enforces strong password policies',plain:'Strong, unique passwords that are hard to guess.',counters:['sql_injection','social_eng']},
  {id:'training',name:'Security Training',icon:'📚',desc:'Educates users to recognise threats',plain:'Teaches people to spot scams and not click risky links.',counters:['malware','social_eng']},
  {id:'monitoring',name:'Continuous Monitoring',icon:'📊',desc:'Records activity and watches for data leaving the organisation',plain:'CCTV for your data. It records who is doing what and notices when information is leaving.',counters:['data_exfil','zero_day']},
  {id:'passkeys',name:'Passkeys - User Account',short:'Passkeys',icon:'🗝️',desc:'Phishing-resistant authentication bound to user devices',plain:'A login tied to your device, so a fake site cannot steal the password.',counters:['phishing','social_eng']},
  {id:'policy',name:'Policy & Procedure',short:'Policy',icon:'📋',desc:'Ensuring robust processes are in place',plain:'Written rules and checks so the right security steps are followed every time.',counters:['insider','data_exfil']}
];

const EFFECTIVENESS={};
DEFENCES.forEach(d=>{EFFECTIVENESS[d.id]=d.counters});

const PRIORITY_MAP={
  'Money':['ransomware','insider','social_eng'],
  'Data':['phishing','sql_injection','data_exfil'],
  'Maintain Services':['malware','ddos','zero_day']
};
const PRIORITY_EMOJIS={'Money':'💰','Data':'💾','Maintain Services':'⚙️'};

// Which priorities each defence protects (Money, Data, Maintain Services), worked out
// from the attacks it counters. Shown as tags on the phone and used in the guides.
const PRIORITY_ORDER=['Money','Data','Maintain Services'];
const DEFENCE_PRIORITIES={};
DEFENCES.forEach(d=>{
  DEFENCE_PRIORITIES[d.id]=PRIORITY_ORDER.filter(p=>d.counters.some(a=>PRIORITY_MAP[p].includes(a)));
});

const ATTACK_COST=100000;
const START_BUDGET=200000;
const MAX_ROUNDS=3;
const SPIN_DURATION=6500;
const DEFAULT_TIMER=120;

const GAME_DATA={
  ATTACKS,DEFENCES,EFFECTIVENESS,
  PRIORITY_MAP,PRIORITY_EMOJIS,PRIORITY_ORDER,DEFENCE_PRIORITIES,
  ATTACK_COST,START_BUDGET,MAX_ROUNDS,SPIN_DURATION,DEFAULT_TIMER
};

// Node.js or browser
if(typeof module!=='undefined'&&module.exports){
  module.exports=GAME_DATA;
}else{
  root.GAME_DATA=GAME_DATA;
}
})(typeof globalThis!=='undefined'?globalThis:this);
