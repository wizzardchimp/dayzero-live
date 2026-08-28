// Day Zero Live — Shared Game Data
// Single source of truth for attacks, defences, and constants.
// Used by server.js (via require), play.html, and dashboard.html.

(function(root){
const ATTACKS=[
  {id:'phishing',name:'Phishing',icon:'🎣',desc:'Deceptive emails to steal credentials',example:'An email from your "CEO" requests urgent gift card purchases'},
  {id:'malware',name:'Malware',icon:'🦠',desc:'Malicious software to compromise systems',example:'An innocent-looking PDF attachment installs a keylogger'},
  {id:'ransomware',name:'Ransomware',icon:'🔒',desc:'Encrypts data and demands payment',example:'All company files encrypted — pay 10 BTC within 48 hours'},
  {id:'ddos',name:'DDoS',icon:'🌊',desc:'Overwhelming traffic to disrupt services',example:'Website returns 503 errors under 500Gbps traffic flood'},
  {id:'sql_injection',name:'SQL Injection',icon:'💉',desc:'Database manipulation via input fields',example:'Login form accepts "\' OR 1=1 —" as valid credentials'},
  {id:'zero_day',name:'Zero-Day Exploit',icon:'⚡',desc:'Attacking unknown vulnerabilities',example:'An unpatched router vulnerability gives attackers full network access'},
  {id:'insider',name:'Insider Threat',icon:'🏢',desc:'Malicious or negligent internal actors',example:'A departing employee copies the entire client database before leaving'},
  {id:'data_exfil',name:'Data Exfiltration',icon:'📤',desc:'Stealing sensitive data from systems',example:'Sensitive spreadsheets are uploaded to a personal cloud account'},
  {id:'social_eng',name:'Social Engineering',icon:'🎭',desc:'Psychological manipulation to gain access',example:'Caller posing as IT support asks you to "verify" your password'}
];

const DEFENCES=[
  {id:'firewall',name:'Firewall',icon:'🛡️',desc:'Monitors and controls network traffic',counters:['phishing','ddos']},
  {id:'endpoint',name:'Endpoint Protection',icon:'💻',desc:'Secure individual devices',counters:['malware','ransomware']},
  {id:'mfa',name:'Multi-Factor Auth',icon:'🔐',desc:'Requires multiple verification methods',counters:['insider','social_eng']},
  {id:'encryption',name:'Encryption',icon:'🔒',desc:'Scrambles data to prevent unauthorised access',counters:['data_exfil','ransomware']},
  {id:'seg',name:'Network Segmentation',icon:'🔀',desc:'Separates the network into departmental areas',counters:['sql_injection','insider']},
  {id:'backup',name:'Backup & Recovery',icon:'💾',desc:'Restores data after loss or attack',counters:['ransomware','ddos']},
  {id:'threat',name:'Threat Detection',icon:'👁️',desc:'Uses AI to monitor network usage of individuals',counters:['zero_day','phishing']},
  {id:'passwords',name:'Secure Passwords',icon:'🔑',desc:'Enforces strong password policies',counters:['sql_injection','social_eng']},
  {id:'training',name:'Security Training',icon:'📚',desc:'Educates users to recognise threats',counters:['malware','social_eng']},
  {id:'monitoring',name:'Continuous Monitoring',icon:'📊',desc:'Tracks systems for unusual behaviour',counters:['data_exfil','zero_day']},
  {id:'passkeys',name:'Passkeys - User Account',icon:'🔑',desc:'Phishing-resistant authentication bound to user devices',counters:['phishing','social_eng']}
];

const EFFECTIVENESS={};
DEFENCES.forEach(d=>{EFFECTIVENESS[d.id]=d.counters});

const PRIORITY_MAP={
  'Money':['ransomware','insider','social_eng'],
  'Data':['phishing','sql_injection','data_exfil'],
  'Maintain Services':['malware','ddos','zero_day']
};
const PRIORITY_EMOJIS={'Money':'💰','Data':'💾','Maintain Services':'⚙️'};

const ATTACK_COST=100000;
const START_BUDGET=300000;
const MAX_ROUNDS=3;
const SPIN_DURATION=7000;
const DEFAULT_TIMER=120;

const GAME_DATA={
  ATTACKS,DEFENCES,EFFECTIVENESS,
  PRIORITY_MAP,PRIORITY_EMOJIS,
  ATTACK_COST,START_BUDGET,MAX_ROUNDS,SPIN_DURATION,DEFAULT_TIMER
};

// Node.js or browser
if(typeof module!=='undefined'&&module.exports){
  module.exports=GAME_DATA;
}else{
  root.GAME_DATA=GAME_DATA;
}
})(typeof globalThis!=='undefined'?globalThis:this);
