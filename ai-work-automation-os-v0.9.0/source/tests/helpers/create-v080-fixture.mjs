import { DatabaseSync } from "node:sqlite";
export function createV080Fixture(path) {
  const db = new DatabaseSync(path);
  db.exec(`
  CREATE TABLE Organization(id TEXT PRIMARY KEY,name TEXT,slug TEXT,status TEXT,createdAt TEXT,updatedAt TEXT);
  CREATE TABLE OrganizationMembership(id TEXT PRIMARY KEY,organizationId TEXT,principalId TEXT,role TEXT,status TEXT,createdAt TEXT,updatedAt TEXT);
  CREATE TABLE Mission(id TEXT PRIMARY KEY,organizationId TEXT,title TEXT,objective TEXT,missionType TEXT,status TEXT,priority TEXT,riskLevel TEXT,approvalMode TEXT,budgetUsd REAL,estimatedCostUsd REAL,successCriteria TEXT,constraints TEXT,input TEXT,currentStage TEXT,deadline TEXT,completedAt TEXT,createdAt TEXT,updatedAt TEXT);
  CREATE TABLE MissionRun(id TEXT PRIMARY KEY,missionId TEXT,idempotencyKey TEXT,requestedBy TEXT,status TEXT,requestHash TEXT,graphRuntimeMode TEXT,graphRuntimeDecisionJson TEXT,organizationRuntimeMode TEXT,organizationRuntimeDecisionJson TEXT,queueMessageId TEXT,queueGeneration INTEGER,lastEnqueuedAt TEXT,lastReconciledAt TEXT,reconcileCount INTEGER,result TEXT,errorCode TEXT,errorMessage TEXT,attemptCount INTEGER,maxAttempts INTEGER,leaseEpoch INTEGER,startedAt TEXT,completedAt TEXT,createdAt TEXT,updatedAt TEXT);
  CREATE TABLE GraphRun(id TEXT PRIMARY KEY,missionRunId TEXT,status TEXT,currentNodeKey TEXT,stateJson TEXT,createdAt TEXT,updatedAt TEXT);
  CREATE TABLE MissionOrganization(id TEXT PRIMARY KEY,organizationId TEXT,missionId TEXT,missionRunId TEXT,status TEXT,createdAt TEXT,updatedAt TEXT);
  CREATE TABLE WorkItem(id TEXT PRIMARY KEY,missionId TEXT,missionRunId TEXT,planKey TEXT,sequence INTEGER,title TEXT,description TEXT,actionKind TEXT,status TEXT,riskLevel TEXT,input TEXT,output TEXT,acceptanceCriteria TEXT,evidence TEXT,attemptCount INTEGER,maxAttempts INTEGER,startedAt TEXT,completedAt TEXT,createdAt TEXT,updatedAt TEXT);
  CREATE TABLE Evaluation(id TEXT PRIMARY KEY,missionId TEXT,missionRunId TEXT,workItemId TEXT,evaluator TEXT,status TEXT,score REAL,summary TEXT,criteriaResults TEXT,evidence TEXT,createdAt TEXT,updatedAt TEXT);
  CREATE TABLE DecisionRecord(id TEXT PRIMARY KEY,missionId TEXT,missionRunId TEXT,authority TEXT,decisionType TEXT,status TEXT,question TEXT,context TEXT,resolution TEXT,resolvedBy TEXT,resolvedAt TEXT,createdAt TEXT,updatedAt TEXT);
  CREATE TABLE Deliverable(id TEXT PRIMARY KEY,missionId TEXT,missionRunId TEXT,type TEXT,title TEXT,version INTEGER,status TEXT,content TEXT,structuredData TEXT,evidence TEXT,createdAt TEXT,updatedAt TEXT);
  CREATE TABLE MissionEvent(id TEXT PRIMARY KEY,missionId TEXT,missionRunId TEXT,eventType TEXT,actorType TEXT,actorId TEXT,message TEXT,payload TEXT,createdAt TEXT);
  `);
  const now = new Date().toISOString();
  db.prepare("INSERT INTO Organization VALUES(?,?,?,?,?,?)").run("org1","Local Company","ai-company","active",now,now);
  db.prepare("INSERT INTO OrganizationMembership VALUES(?,?,?,?,?,?,?)").run("mem1","org1","local:owner","ceo","active",now,now);
  db.prepare("INSERT INTO Mission VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("m1","org1","Dashboard Design","운영 대시보드 UX/UI 설계","design","completed","normal","GREEN","delegated",5,0,'["사용 가능"]',"[]","{}","completed",null,now,now,now);
  db.prepare("INSERT INTO MissionRun VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("r1","m1","key1","local:owner","completed","hash","conditional","{}","active","{}",null,0,null,null,0,"{}",null,null,1,3,1,now,now,now,now);
  db.prepare("INSERT INTO GraphRun VALUES(?,?,?,?,?,?,?)").run("g1","r1","completed","finalize","{}",now,now);
  db.prepare("INSERT INTO MissionOrganization VALUES(?,?,?,?,?,?,?)").run("mo1","org1","m1","r1","completed",now,now);
  db.prepare("INSERT INTO WorkItem VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("w1","m1","r1","design",1,"UI Spec","화면 명세","internal","completed","GREEN","{}",'{"markdown":"ok"}','["criteria"]',"[]",1,2,now,now,now,now);
  db.prepare("INSERT INTO Evaluation VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run("e1","m1","r1","w1","verifier","passed",1,"ok","[]","[]",now,now);
  db.prepare("INSERT INTO DecisionRecord VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run("d1","m1","r1","ceo","approval","resolved","continue","{}","approved","local:owner",now,now,now);
  db.prepare("INSERT INTO Deliverable VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run("a1","m1","r1","report","Final",1,"verified","# Final","{}","[]",now,now);
  db.prepare("INSERT INTO MissionEvent VALUES(?,?,?,?,?,?,?,?,?)").run("ev1","m1","r1","mission.completed","system","runtime","done","{}",now);
  db.close();
}

export function addOutOfOrderOrganizationFixture(path) {
  const db = new DatabaseSync(path);
  const now = new Date().toISOString();
  db.exec(`
    CREATE TABLE MissionDepartment(
      id TEXT PRIMARY KEY, missionOrganizationId TEXT, key TEXT, name TEXT, mission TEXT, status TEXT,
      depth INTEGER, leaderRoleKey TEXT, requiredCapabilities TEXT, completionCriteria TEXT,
      budgetLimitMicros INTEGER, budgetReservedMicros INTEGER, budgetUsedMicros INTEGER,
      createdAt TEXT, updatedAt TEXT
    );
    CREATE TABLE MissionTeam(
      id TEXT PRIMARY KEY, missionOrganizationId TEXT, departmentId TEXT, parentTeamId TEXT,
      key TEXT, name TEXT, objective TEXT, status TEXT, depth INTEGER, leadRoleKey TEXT, graphSpecKey TEXT,
      minMembers INTEGER, maxMembers INTEGER, requiredCapabilities TEXT, completionCriteria TEXT,
      budgetLimitMicros INTEGER, budgetReservedMicros INTEGER, budgetUsedMicros INTEGER,
      createdAt TEXT, updatedAt TEXT
    );
    CREATE TABLE RoleDefinition(
      id TEXT PRIMARY KEY, missionOrganizationId TEXT, departmentId TEXT, teamId TEXT, key TEXT, title TEXT,
      category TEXT, description TEXT, specJson TEXT, reportsToRoleKey TEXT, toolPolicyId TEXT, modelClass TEXT,
      isLead INTEGER, isVerifier INTEGER, mayCreateRoles INTEGER, mayCreateTeams INTEGER, maxDirectReports INTEGER,
      budgetAuthorityMicros INTEGER, temporary INTEGER, status TEXT, createdAt TEXT, updatedAt TEXT
    );
    CREATE TABLE AgentInstance(
      id TEXT PRIMARY KEY, missionOrganizationId TEXT, departmentId TEXT, teamId TEXT, roleDefinitionId TEXT,
      managerAgentId TEXT, ordinal INTEGER, title TEXT, status TEXT, provider TEXT, model TEXT,
      capabilitiesJson TEXT, authorityJson TEXT, permissionsJson TEXT, contextScopeJson TEXT,
      budgetLimitMicros INTEGER, budgetUsedMicros INTEGER, temporary INTEGER, activatedAt TEXT, retiredAt TEXT,
      createdAt TEXT, updatedAt TEXT
    );
  `);
  db.prepare("INSERT INTO MissionDepartment VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    "dep1", "mo1", "design", "Design", "design mission", "active", 1, "director", '["design"]', '["done"]', 1000000, 0, 0, now, now
  );
  // Deliberately insert child before parent.
  db.prepare("INSERT INTO MissionTeam VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    "team-child", "mo1", "dep1", "team-parent", "child", "Child Team", "child", "active", 3, "child-lead", "default", 1, 3, '["child"]', '["done"]', 100000, 0, 0, now, now
  );
  db.prepare("INSERT INTO MissionTeam VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    "team-parent", "mo1", "dep1", null, "parent", "Parent Team", "parent", "active", 2, "parent-lead", "default", 1, 4, '["parent"]', '["done"]', 200000, 0, 0, now, now
  );
  const role = db.prepare("INSERT INTO RoleDefinition VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  role.run("role-manager", "mo1", "dep1", "team-parent", "manager", "Manager", "manager", "", '{"capabilities":["manage"],"permissions":["work:assign"]}', null, "controlled", "balanced", 1, 0, 1, 0, 5, 200000, 1, "active", now, now);
  role.run("role-child", "mo1", "dep1", "team-child", "specialist", "Specialist", "specialist", "", '{"capabilities":["execute"],"permissions":["artifact:write"]}', "manager", "controlled", "balanced", 0, 0, 0, 0, 0, 100000, 1, "active", now, now);
  const agent = db.prepare("INSERT INTO AgentInstance VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  // Deliberately insert report before manager.
  agent.run("agent-child", "mo1", "dep1", "team-child", "role-child", "agent-manager", 1, "Specialist", "active", null, null, '["execute"]', '[]', '["artifact:write"]', '[]', 100000, 0, 1, now, null, now, now);
  agent.run("agent-manager", "mo1", "dep1", "team-parent", "role-manager", null, 1, "Manager", "active", null, null, '["manage"]', '[]', '["work:assign"]', '[]', 200000, 0, 1, now, null, now, now);
  db.close();
}
