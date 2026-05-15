"""Update speaker_notes ONLY in CF-103 Lab 4 slide JSON."""
import json
from pathlib import Path

TARGET = Path(r"I:/My Drive/CourseCreationKit/courses/SYF/stream1_cloud_foundations/CF-103_AWS_Core_Services/slide_json/CF-103_Lab_4_roi_slides.json")

# Speaker notes indexed by slide number (1-based matching the count output)
NOTES = {
    1: (
        "Welcome to Lab 4, the most comprehensive of our CF-103 labs. "
        "Over the next 45 minutes we'll provision an encrypted RDS PostgreSQL instance and wire a Lambda function into it through private VPC networking, which is the pattern [Client] uses any time serverless compute needs a relational database."
    ),
    2: (
        "This overview slide frames the lab scope before we touch the console. "
        "Call out that the RDS instance alone takes ten to fifteen minutes to create, so students will kick it off early and configure Lambda while it provisions."
    ),
    3: (
        "Five concrete outcomes for the lab. "
        "By the end of the session students will have built a working serverless plus managed database pattern end to end, with [Client] encryption, tagging, and security group standards applied throughout."
    ),
    4: (
        "Transition from: We just walked through the objectives for Lab 4.\n\n"
        "Transition to: Next we'll lay out the components we'll actually build.\n\n"
        "Why this is important: Grounding the lab in a realistic [Client] scenario helps students see why each configuration choice exists. A compliant database with least privilege compute access is not an academic exercise, it is the baseline shape of almost every new microservice that touches data at [Client].\n\n"
        "Slide notes: Walk through the scenario. A [Client] application team is standing up a new microservice that needs a PostgreSQL database and a scheduled Lambda to run maintenance queries, reports, and integrity checks. Call out the three hard requirements: encryption at rest with a [Client] managed KMS key, placement in approved private subnets with no public access, and a security group that only allows Lambda to reach the database. Emphasize that students are playing the role of the platform engineer who has to get this right on day one.\n\n"
        "Instructor notes: This scenario intentionally mirrors real [Client] workloads. RDS is one of the approved database services along with Aurora. Lambda is the approved serverless compute. The combination of private subnets, customer managed KMS, and security group references is how [Client] meets internal audit and PCI expectations without writing custom policy. If students ask about DynamoDB, reinforce that it is not on the approved list and the equivalent pattern would use Aurora instead. If they ask about ECS, remind them that [Client] has standardized on EKS for containers, but this lab deliberately uses Lambda to teach the serverless to private RDS pattern."
    ),
    5: (
        "Transition from: We just covered the scenario driving this lab.\n\n"
        "Transition to: Once everyone is clear on the target architecture, we'll jump into the RDS console.\n\n"
        "Why this is important: A summary of the moving parts gives students a mental model before they start clicking. Without this picture, the twenty one step walkthrough feels like disconnected button clicks instead of building one coherent system.\n\n"
        "Slide notes: Walk the table top to bottom. PostgreSQL 15 on db.t3.micro keeps lab cost low while matching [Client]'s dev tier standards. SSE-KMS with a [Client] managed key is non-negotiable and must be chosen at creation time. The database lives in private data subnets with no public access. The RDS security group only accepts inbound PostgreSQL from the Lambda security group, not a CIDR range. Lambda is preconfigured and we'll attach it to the VPC ourselves. All resources carry the mandatory tag set.\n\n"
        "Instructor notes: The instance class in the lab uses db.t3.micro to keep cost under a dollar a day, though the written lab guide references db.t3.medium as the [Client] development standard. Either one works in the training account. Multi-AZ in true [Client] production is required, but the Dev/Test template we're using in this lab does not enable it by default and that is intentional to keep the lab cheap and fast. Make sure students understand the security group reference pattern before moving on, because it's the single most important concept in this lab."
    ),
    6: (
        "Transition from: We just reviewed the target architecture in the summary table.\n\n"
        "Transition to: Next we'll pick the creation method and engine inside the RDS wizard.\n\n"
        "Why this is important: Starting the RDS creation now lets the instance provision in the background while we configure Lambda. If students wait until after Lambda is done, they'll sit idle for ten plus minutes staring at a loading spinner.\n\n"
        "Slide notes: Walk students through sign in via [Client] SSO, confirming they're in the non-production training account, and verifying the region is us-east-1. In the console search bar they type RDS and navigate to the service. Then click Create database to enter the wizard. Remind them that any work done in the wrong region or account will not find the expected VPC and KMS key later.\n\n"
        "Instructor notes: [Client]'s SSO portal lists multiple AWS accounts. The training or non-production account is the right target. If a student accidentally lands in production or shared services, IAM should block most of what they try to do, but they'll also waste time troubleshooting. Region matters because VPCs, subnets, KMS keys, and security groups are all regional, and the [Client] training VPC only exists in us-east-1."
    ),
    7: (
        "Transition from: We just signed in and navigated to the RDS service.\n\n"
        "Transition to: After picking the engine we'll choose a template that matches our environment.\n\n"
        "Why this is important: Standard create is the only path that exposes the settings [Client] cares about, including KMS key selection, subnet group, and backup configuration. Easy create hides those fields and would leave students with a non compliant database.\n\n"
        "Slide notes: On this slide students pick Standard create, choose PostgreSQL as the engine, and select the latest PostgreSQL 15 version. Point out where these radio buttons live in the console. Emphasize that PostgreSQL 15 is the [Client] approved version for new development today.\n\n"
        "Instructor notes: PostgreSQL is the [Client] default for new relational workloads because it has no license cost, strong AWS integration, and mature tooling. If a student asks why not MySQL or Oracle, the answer is a mix of licensing and internal standardization. Engine versions are occasionally deprecated by AWS, so if PostgreSQL 15 is not in the dropdown on training day, choose the latest 15.x variant available."
    ),
    8: (
        "Transition from: We just chose PostgreSQL 15 as the engine.\n\n"
        "Transition to: After templates, we'll move on to naming the instance and setting credentials.\n\n"
        "Why this is important: The template selection controls which defaults the wizard applies to downstream fields like Multi-AZ, storage, and backups. Choosing Dev/Test keeps the lab cheap without manually turning off a dozen production features.\n\n"
        "Slide notes: Students select the Dev/Test template. Call out that this template optimizes defaults for non-production use. Contrast it with the Production template, which would enable Multi-AZ and pick larger storage. We don't need Multi-AZ for a short lived lab database.\n\n"
        "Instructor notes: In real [Client] production, Multi-AZ is required for relational databases. The lab deliberately uses Dev/Test so students don't burn credits on an idle standby instance. If a student selects Production by mistake, the lab still works, it just costs more and takes longer to provision. No need to restart, just note it and move on."
    ),
    9: (
        "Transition from: We just picked the Dev/Test template.\n\n"
        "Transition to: Next we'll choose the instance class that runs the database engine.\n\n"
        "Why this is important: This is where students set the master password they'll need twenty minutes from now when Lambda tries to connect. If they don't write it down, they'll get an authentication error they can't debug without resetting the credentials.\n\n"
        "Slide notes: Students set the DB instance identifier to dev-yourname-postgres, master username to dbadmin, credentials management to Self managed, and then create a strong password they enter twice. Stress that they must save the password somewhere they can retrieve it. A sticky note in the CloudShell pane works fine, a password manager is better.\n\n"
        "Instructor notes: In production [Client] uses Secrets Manager for credential storage and rotation, and IAM database authentication where the workload supports it. We're using self managed passwords here because it's the simplest path that still teaches the connectivity pattern. If a student asks about IAM auth, acknowledge it exists and point to the production considerations slide at the end."
    ),
    10: (
        "Transition from: We just named the instance and set the master password.\n\n"
        "Transition to: Next we'll configure storage for the instance.\n\n"
        "Why this is important: Instance class is a direct cost lever and also a capacity lever. Picking the smallest approved class keeps the lab affordable while still running PostgreSQL with enough memory to respond to Lambda queries.\n\n"
        "Slide notes: Students expand Burstable classes and pick db.t3.micro. Two vCPU and one gigabyte of RAM is plenty for a single Lambda connection running three simple queries. Note that db.t3.micro is the smallest class [Client] allows for lab and dev use.\n\n"
        "Instructor notes: If db.t3.micro is not available in the dropdown, db.t3.small works identically for this lab. Some training accounts have instance limits that hide the smallest options. On cost, db.t3.micro is roughly two cents an hour, so a lab left running overnight is still under a dollar, but the cleanup slide at the end is there for a reason. Production workloads at [Client] live on db.r6g or db.m6g class instances, not burstable."
    ),
    11: (
        "Transition from: We just picked the db.t3.micro instance class.\n\n"
        "Transition to: Next we'll configure how the database connects to the VPC.\n\n"
        "Why this is important: Storage type and autoscaling decisions have outsized impact on both performance and cost. Getting the defaults right now saves students from noisy neighbor issues or runaway storage bills later.\n\n"
        "Slide notes: Students choose gp3 storage type, allocate twenty gigabytes, enable storage autoscaling, set the maximum storage threshold to one hundred gigabytes, and leave provisioned IOPS at the default three thousand. Point out that gp3 is the modern general purpose SSD option and is almost always the right choice over gp2.\n\n"
        "Instructor notes: gp3 decouples IOPS and throughput from capacity, which means you pay for performance separately instead of having to scale up storage to get more IOPS. The twenty gigabyte allocation is fine for a lab that only runs three SELECT queries. Autoscaling on with a one hundred gigabyte cap is a good habit to reinforce because it prevents a runaway workload from filling the disk and taking the database offline. Storage cost is roughly eight cents per gigabyte per month."
    ),
    12: (
        "Transition from: We just configured storage type and autoscaling.\n\n"
        "Transition to: Next we'll create a security group for this RDS instance.\n\n"
        "Why this is important: Connectivity choices are where compliance either happens or breaks. Public access on a database at [Client] is an immediate audit finding. The wizard makes it easy to pick the right VPC and refuse a public IP, so we want students to see exactly where those toggles live.\n\n"
        "Slide notes: Students leave the compute resource option as Don't connect, set network type to IPv4, pick the [Client] non-prod VPC, either create a new DB subnet group or pick the existing one with private data subnets, and set public access to No. Emphasize that public access No is non-negotiable for any [Client] database.\n\n"
        "Instructor notes: If the expected VPC is not in the dropdown, the most common cause is wrong region. VPCs are regional. The DB subnet group is a named collection of subnets across at least two availability zones where RDS is allowed to place the instance or its standby. If students create a new subnet group, walk them through picking two private subnets in different AZs. If they pick an existing one, confirm it contains private subnets only."
    ),
    13: (
        "Transition from: We just picked the VPC and subnet group.\n\n"
        "Transition to: Next we'll choose how clients authenticate to the database.\n\n"
        "Why this is important: Creating the RDS security group now, even knowing we'll rewrite its rules later, is the cleanest way to get a named security group dedicated to this database. Reusing a shared security group would let other workloads silently gain database access.\n\n"
        "Slide notes: Students create a new security group named dev-yourname-rds-sg, set availability zone to No preference, and note that we'll come back and rewrite the inbound rules after the Lambda security group exists. The wizard will initially add their current IP as an inbound source, which we will remove later.\n\n"
        "Instructor notes: AWS's default behavior of adding your current IP is a convenience for people using local database clients, but it's exactly the pattern [Client] wants to avoid. We'll delete that rule once the Lambda security group exists because only Lambda should reach this database. If a student asks why not configure the Lambda security group first, the answer is that the RDS wizard forces security group creation at this step, so we accept the default placeholder and fix it later."
    ),
    14: (
        "Transition from: We just configured the RDS security group placeholder.\n\n"
        "Transition to: Next we'll expand additional configuration to set the database name and backup policy.\n\n"
        "Why this is important: Database authentication choice shapes what secrets the application has to manage. Password auth is the simplest starting point but carries long term operational cost. Understanding the tradeoff now prepares students for the production considerations slide later.\n\n"
        "Slide notes: Students pick Password authentication. Point out the IAM authentication option in the radio group and explain that it issues short lived tokens instead of passwords. Mention that [Client] recommends IAM database authentication for automated workloads where it's supported.\n\n"
        "Instructor notes: IAM database authentication works by having clients call rds:GenerateDbAuthToken, which returns a time-limited token used in place of a password. It requires extra Lambda configuration, including the token generation code and an IAM policy that grants rds-db:connect on the specific database user ARN. For simplicity this lab uses a password. In a real [Client] automation pipeline, the pattern would be IAM auth plus a [Client] issued role, not environment variable passwords."
    ),
    15: (
        "Transition from: We just chose password authentication.\n\n"
        "Transition to: Next we'll enable encryption with the [Client] KMS key.\n\n"
        "Why this is important: Setting the initial database name and backup retention at creation time saves a round trip later. Forgetting to set an initial database means students have to connect as admin and run CREATE DATABASE manually before the lab Lambda will work.\n\n"
        "Slide notes: Students expand Additional configuration, set Initial database name to appdb, leave the parameter group at default.postgres15, set backup retention to seven days, and enable automatic backups. Emphasize that appdb is the exact string we reference in the Lambda environment variable DB_NAME later.\n\n"
        "Instructor notes: [Client] policy requires backups on all databases. Development databases get a seven day minimum retention and production gets fourteen days or more depending on the workload's compliance tier. If a student forgets to set Initial database name, Lambda will connect to the default postgres database and most queries still work, but it's a good habit to define an application database explicitly. Parameter groups can be customized later for tuning, but default.postgres15 is fine for the lab."
    ),
    16: (
        "Transition from: We just set the initial database name and backup retention.\n\n"
        "Transition to: Next we'll tune monitoring and deletion protection for lab use.\n\n"
        "Why this is important: Encryption at rest with a [Client] managed KMS key is the hardest compliance requirement to fix after the fact. If students accidentally create an unencrypted database, they have to create a new one and migrate, which is exactly the situation we are teaching them to avoid.\n\n"
        "Slide notes: Students confirm Enable encryption is checked, then pick the [Client] RDS KMS key from the dropdown. Look for an alias containing syf, client, or [Client]. Do not accept the default aws/rds key. Remind them this choice cannot be changed after the database is created.\n\n"
        "Instructor notes: The difference between the AWS managed aws/rds key and a customer managed key is control. Customer managed keys let [Client] set rotation policies, scope access with key policies, and produce CloudTrail events for every key use. Audit and security teams need those controls. Cost for a customer managed KMS key is one dollar per month per key plus a fraction of a cent per ten thousand API calls, negligible for a lab. If the expected key is not visible in the dropdown, the student's IAM role does not have kms:DescribeKey on that key, which is a lab environment setup issue to flag."
    ),
    17: (
        "Transition from: We just enabled encryption with the [Client] KMS key.\n\n"
        "Transition to: Next we'll add the mandatory [Client] tag set.\n\n"
        "Why this is important: Monitoring and maintenance settings are both cost levers and safety levers. In production we want enhanced monitoring and deletion protection on. In a lab we want neither so cleanup is fast and cheap.\n\n"
        "Slide notes: Students disable enhanced monitoring to keep cost down, enable auto minor version upgrade so AWS handles patches, leave the maintenance window at No preference, and disable deletion protection so they can tear the database down at the end of the lab. Call out that deletion protection must be enabled in real production.\n\n"
        "Instructor notes: Enhanced monitoring collects OS level metrics at one second granularity and costs about two dollars per month per instance. It's worth it in production but wasteful in a lab. Auto minor version upgrade is safe for development and lets AWS handle CVE patches for you. Deletion protection adds a confirmation step that prevents accidental drops, and is always on in [Client] production. If a student asks, the delete operation ignores deletion protection only after you explicitly disable it and re-save the instance."
    ),
    18: (
        "Transition from: We just set monitoring and deletion protection to lab-appropriate defaults.\n\n"
        "Transition to: Next we'll apply the [Client] mandatory tag set and kick off creation.\n\n"
        "Why this is important: Tags drive cost allocation, ownership, and compliance reporting at [Client]. A database without tags is unattributable cost, which shows up immediately in the finance team's weekly unassigned resources report.\n\n"
        "Slide notes: Students expand the Tags section and add Name, Project, Environment, Owner, and CostCenter. Make the Name match the DB instance identifier. Use training-lab for Project, development for Environment, the student email for Owner, and CC-TRAINING for CostCenter.\n\n"
        "Instructor notes: The [Client] tag standard is five keys at minimum, and some resources require a sixth ManagedBy tag. The lab accepts five for simplicity. Tags on the RDS instance propagate to automated snapshots only if you enable the CopyTagsToSnapshot option, which is on by default in newer AWS CLI versions but worth checking. If a student forgets a tag, point them to the post-creation Tags tab where they can add it later."
    ),
    19: (
        "Transition from: We just added the mandatory tag set.\n\n"
        "Transition to: Next we'll switch contexts and start building the Lambda security group while RDS provisions.\n\n"
        "Why this is important: Once students click Create database, they are committed to ten to fifteen minutes of wait time. Using that wait to configure Lambda in parallel is the only way the lab finishes in forty five minutes.\n\n"
        "Slide notes: Students review the estimated monthly cost, click Create database, and watch the status move to Creating. Tell them to note the creation start time and immediately move on to the next slide rather than staring at the status page. We'll come back to RDS when it reaches Available.\n\n"
        "Instructor notes: Estimated monthly cost for db.t3.micro with twenty gigabytes of gp3 and seven day backups is roughly twenty dollars a month if left running continuously. The lab only runs for an hour, so actual cost is a few cents. If creation fails immediately with a validation error, the most common causes are a KMS key the student's role cannot use, a subnet group with subnets in only one AZ, or a password that does not meet the complexity requirements. The error message will name the specific field."
    ),
    20: (
        "Transition from: We just started RDS creation and switched focus to Lambda.\n\n"
        "Transition to: Next we'll update the RDS security group to reference this Lambda security group.\n\n"
        "Why this is important: Lambda needs its own security group so we can reference it as the source in the RDS security group inbound rule. This is the security group chaining pattern that makes access self-maintaining as Lambda functions scale up and down.\n\n"
        "Slide notes: Students navigate to VPC then Security Groups, click Create security group, name it dev-yourname-lambda-sg, give it a meaningful description, pick the [Client] non-prod VPC, and leave inbound rules empty. Keep the default All traffic outbound rule. Call out that Lambda does not receive inbound connections, so inbound rules are unnecessary.\n\n"
        "Instructor notes: A security group with no inbound rules behaves correctly for Lambda because Lambda invocations come through the AWS Lambda service boundary, not through the VPC. The security group is still required because Lambda's VPC configuration needs one to assign to the ENIs it creates. Outbound All traffic is the default because Lambda frequently talks to multiple services, and restricting outbound to just port 5432 would break any code that also calls AWS APIs over HTTPS."
    ),
    21: (
        "Transition from: We just created the Lambda security group.\n\n"
        "Transition to: Next we'll pivot to the Lambda function itself and review its code.\n\n"
        "Why this is important: This is the moment the security group reference pattern comes together. Referencing the Lambda security group as the source instead of an IP range means any resource with that security group attached is automatically authorized to reach the database.\n\n"
        "Slide notes: Students navigate back to VPC Security Groups, find dev-yourname-rds-sg, edit inbound rules, and delete the auto-added rule that allows their personal IP. Then they add a new rule with Type PostgreSQL which sets port 5432, and Source set to Security group pointing at dev-yourname-lambda-sg. Save the rules.\n\n"
        "Instructor notes: The source type toggle is easy to miss. Students need to pick Security group, not Custom or Anywhere. Once saved, the rule shows as sg-xxxxx in the source column. If they leave it as their personal IP, the lab will still work from their local machine using a client like pgAdmin, but Lambda will fail with a timeout because its ENI IP is not on the allow list. The security group reference works regardless of Lambda's actual IP."
    ),
    22: (
        "Transition from: We just pointed the RDS security group at the Lambda security group.\n\n"
        "Transition to: Next we'll walk through the actual Python code the function runs.\n\n"
        "Why this is important: Reading the function before configuring it makes the environment variables we set later make sense. Students should understand which code path reads DB_HOST and what the function returns on success versus failure.\n\n"
        "Slide notes: Students navigate to the Lambda service, find the pre-built function named syf-lab-rds-test or similar, and open it. Tell them to scan the code for imports, the handler function, and where environment variables are read. The instructor confirms the exact function name in their specific training account.\n\n"
        "Instructor notes: The function uses psycopg2, the standard Python PostgreSQL driver. It reads DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD from environment variables, opens a connection, runs a version query, and returns the version string. If the pre-built function does not exist in the training account, have students create a new Python 3.12 Lambda and paste in the code from the lab guide. The ZIP with psycopg2-binary is also in the lab guide in case they need to build the deployment package from scratch."
    ),
    23: (
        "Transition from: We just opened the pre-built Lambda function.\n\n"
        "Transition to: Next we'll attach this function to the VPC so it can actually reach RDS.\n\n"
        "Why this is important: Walking through the code line by line gives students the mental model they need to debug when something goes wrong. If they see a timeout later, they need to know exactly which line is hanging and why.\n\n"
        "Slide notes: Walk the code on screen. The os.environ calls on lines 6 through 9 pull connection info from the Lambda environment variables we'll set two slides from now. The psycopg2.connect call opens the actual TCP connection to the database. The cursor.execute runs SELECT version, which is a trivial query that only works if the connection is fully established. The return statement sends the PostgreSQL version back to the caller.\n\n"
        "Instructor notes: psycopg2 is the mature PostgreSQL adapter for Python. psycopg2-binary is the version you bundle in a Lambda deployment package because it includes pre-compiled C extensions. Production code would add connection retries, use RDS Proxy for pooling, and fetch credentials from Secrets Manager inside the handler. The lab version is deliberately minimal so the failure modes are easy to diagnose. If a connection fails, only one of five things went wrong: wrong VPC, wrong subnets, wrong security group, wrong endpoint, or wrong password."
    ),
    24: (
        "Transition from: We just walked through the Lambda function code.\n\n"
        "Transition to: Next we'll inject the RDS connection details as environment variables.\n\n"
        "Why this is important: Lambda defaults to running in an AWS managed VPC that has no route to your VPCs. Without explicit VPC configuration, the function cannot reach an RDS instance in a private subnet. This step is the bridge between serverless and VPC networking.\n\n"
        "Slide notes: Students go to Configuration, then VPC, and click Edit. They pick the [Client] non-prod VPC, select at least two private application subnets for high availability, pick dev-yourname-lambda-sg as the security group, and save. Warn them that the save operation can take thirty to sixty seconds while Lambda provisions ENIs.\n\n"
        "Instructor notes: Lambda creates a hyperplane ENI in each selected subnet on first invocation and reuses those ENIs across concurrent executions. The cold start penalty for VPC Lambda used to be significant, but modern AWS uses a shared ENI pool that reduces cold starts to sub-second. Picking at least two subnets in different AZs is a high availability best practice because if one subnet runs out of IPs, Lambda falls back to the other. The Lambda execution role must include VPC permissions, which we attach two slides from now."
    ),
    25: (
        "Transition from: We just attached the Lambda function to the VPC.\n\n"
        "Transition to: Next we'll give the Lambda execution role permission to create ENIs.\n\n"
        "Why this is important: Environment variables are how the function knows where to connect and with what credentials. Getting DB_HOST wrong is the most common lab failure mode, and it manifests as a DNS resolution error that students often misdiagnose as a network problem.\n\n"
        "Slide notes: Students go to Configuration, then Environment variables, click Edit, and add four variables. DB_HOST is the RDS endpoint, which they copy from the RDS console. DB_NAME is appdb. DB_USER is dbadmin. DB_PASSWORD is whatever they set during RDS creation. Before saving, students must verify the RDS instance has reached Available status.\n\n"
        "Instructor notes: The RDS endpoint is a DNS name, not an IP. It resolves to the primary instance and automatically updates during a Multi-AZ failover. Students should copy the exact endpoint from the RDS console rather than typing it, because a single character off means DNS resolution fails. In production, DB_PASSWORD would never live in an environment variable. The correct pattern is Secrets Manager with the Lambda pulling the current password at cold start and caching it for the duration of the container. That's covered on the production considerations slide."
    ),
    26: (
        "Transition from: We just set the database connection environment variables.\n\n"
        "Transition to: Next we'll run the function and verify the whole chain works.\n\n"
        "Why this is important: Without the VPC access execution role policy, Lambda cannot create the ENIs it needs to reach resources in the VPC. This is the most common single cause of function creation failures for VPC Lambda.\n\n"
        "Slide notes: Students go to Configuration, then Permissions, click the execution role name to open IAM in a new tab, click Attach policies, search for AWSLambdaVPCAccessExecutionRole, select it, and click Attach. This adds permissions to create, describe, and delete network interfaces in the VPC.\n\n"
        "Instructor notes: AWSLambdaVPCAccessExecutionRole is an AWS managed policy that grants ec2:CreateNetworkInterface, ec2:DescribeNetworkInterfaces, and ec2:DeleteNetworkInterface. Lambda uses these to manage the ENIs it creates when you attach the function to a VPC. Without the policy, the function will appear to be configured correctly but will fail on first invocation with an EC2 permission error. The policy is scoped to actions only, not resources, which is acceptable because Lambda manages the ENI lifecycle automatically. You can build a tighter custom policy if your security team requires it."
    ),
    27: (
        "Transition from: We just attached the VPC access execution policy.\n\n"
        "Transition to: Next we'll validate every requirement against a checklist.\n\n"
        "Why this is important: This is the moment of truth for the lab. Every configuration choice we made, from subnet selection to security group references to environment variables, either holds up under a real request or reveals a misconfiguration. Running the test is how students learn which layer actually broke when something fails.\n\n"
        "Slide notes: Students go to the Test tab, use the default hello-world template which sends an empty event, and click Test. First invocation can take ten to fifteen seconds because the ENI has to be provisioned. Expected success response includes the PostgreSQL version string in the body. If the test fails, the four most common errors are timeout, connection refused, authentication failed, and DNS resolution.\n\n"
        "Instructor notes: Walk the four failure modes. Timeout means the Lambda can't reach RDS, which is almost always a security group issue or wrong VPC or subnets. Connection refused means the TCP handshake got there but the port is wrong or RDS is not fully up yet. Authentication failed means the username or password is wrong, usually a typo in DB_PASSWORD. DNS resolution failure means DB_HOST is misspelled or includes the port suffix. Knowing which of the four you're seeing narrows the fix down to one layer of the stack, which is the whole point of the exercise."
    ),
    28: (
        "Transition from: We just ran the first successful test of the Lambda function.\n\n"
        "Transition to: Next we'll dig into CloudWatch Logs to see the function's output in detail.\n\n"
        "Why this is important: A checklist turns vague success into documented completion. In a real [Client] change request, the reviewer expects to see exactly this kind of evidence that each compliance requirement was met before the change is approved.\n\n"
        "Slide notes: Walk the table row by row. RDS should show Available. Encryption should show the [Client] KMS key ID. Public access should show No. Tags should show all five mandatory keys populated. Lambda VPC config should show both private subnets and the Lambda security group. The Lambda test should return the PostgreSQL version in the body of the response.\n\n"
        "Instructor notes: This validation pattern, a concrete checklist of observable evidence, is exactly what the [Client] cloud governance team wants to see in change tickets. Teach it as the deliverable format, not just a lab exercise. If any row shows an unexpected value, the student has one or more misconfigurations to fix before moving on. Common issues at this step: KMS key was default instead of [Client] managed, public access was accidentally enabled, one mandatory tag is missing."
    ),
    29: (
        "Transition from: We just validated the lab against the checklist.\n\n"
        "Transition to: Next we'll clean up so nobody leaves a running database behind.\n\n"
        "Why this is important: CloudWatch Logs is where every Lambda invocation writes its output, and it's the first place an operator looks when something fails in production. Students who can navigate to the right log stream and interpret what they see are prepared to troubleshoot real incidents.\n\n"
        "Slide notes: Students navigate to CloudWatch, then Log groups, find /aws/lambda/ followed by the function name, click into the latest log stream, and read the log events. A successful invocation shows a START RequestId line, any print or log statements from the function, an END RequestId line, and a REPORT line with duration and memory used.\n\n"
        "Instructor notes: The REPORT line is worth pointing out. It includes init duration for cold starts, total duration, billed duration, memory size configured, and max memory used. If max memory used is near the configured memory size, the function may be under-provisioned. If init duration is high for a VPC Lambda, that's the ENI setup cost. Log groups retain forever by default, which can become expensive at scale. In [Client] production, log groups have a retention policy of thirty or ninety days depending on the workload."
    ),
    30: (
        "Transition from: We just reviewed the Lambda execution in CloudWatch Logs.\n\n"
        "Transition to: Next we'll test understanding with a troubleshooting scenario.\n\n"
        "Why this is important: RDS is the most expensive resource in this lab and students often forget to clean up, which leaves a running database billing the training account until someone notices. Teaching cleanup as a discipline now avoids surprise bills later.\n\n"
        "Slide notes: Walk the three step cleanup order. First, remove the Lambda function's VPC configuration. This releases the ENIs, which must happen before the security groups can be deleted. Second, delete the RDS instance by choosing Delete from the Actions menu, opting to skip the final snapshot for the lab, and typing delete me to confirm. Third, once RDS is fully deleted and the Lambda ENIs are gone, delete both the Lambda and RDS security groups.\n\n"
        "Instructor notes: Security groups cannot be deleted while any ENI references them. The most common cleanup failure is a student who deletes the Lambda function but forgets that the VPC configuration keeps ENIs around for a few minutes, then tries to delete the security group and gets an error. Wait five minutes if the security group delete fails. RDS deletion takes five to ten minutes because it needs to tear down automatic backups and snapshots. Deletion protection was disabled during creation, so no extra steps needed there. If a student forgot to disable deletion protection, they'll need to modify the instance to turn it off before the delete will proceed."
    ),
    31: (
        "Transition from: We just walked through the cleanup procedure.\n\n"
        "Transition to: After this question we'll work through a second knowledge check on access patterns.\n\n"
        "Why this is important: This scenario is the exact troubleshooting path [Client] engineers walk every time a new Lambda to RDS integration fails its first test. If students internalize the triage order now, they'll save hours of debugging time in real incidents.\n\n"
        "Slide notes: Read the question aloud and give students thirty seconds to think. The setup describes a Lambda timeout with a correctly configured security group, and asks what to check next. The four options cover public IPs for Lambda, VPC and subnet routing, enabling public RDS access, and IAM rds:Connect permission. The correct answer is B, VPC and subnet routing.\n\n"
        "Instructor notes: The reasoning: when security groups look right but traffic still does not flow, the next layer down is VPC and subnet routing. A Lambda attached to a subnet that cannot route to the RDS subnet will always time out regardless of security group rules. A is wrong because Lambda in a VPC uses private IPs only and an Internet Gateway is not in the path. C is wrong and would be an audit finding because [Client] databases must not be public. D is wrong because the lab uses password authentication, and rds:Connect is the IAM action used only for IAM database authentication. Reinforce the triage order: same VPC, subnet routing, security groups, in that order."
    ),
    32: (
        "Transition from: We just reasoned through the Lambda timeout question.\n\n"
        "Transition to: Next we'll summarize what the lab accomplished end to end.\n\n"
        "Why this is important: Developer access to production-adjacent databases is a recurring real world question, and the wrong answer can create a significant security incident. Teaching the approved pattern now, before students are under pressure on a real ticket, is the best way to make sure they reach for the right tool.\n\n"
        "Slide notes: Read the question aloud. The setup describes a developer who wants to debug by connecting from their laptop to the RDS database. The four options cover opening port 5432 to the internet, adding the developer's IP to the security group, using a bastion or Session Manager port forwarding, and enabling public access on RDS. The correct answer is C, bastion or Session Manager port forwarding.\n\n"
        "Instructor notes: Session Manager port forwarding lets a developer tunnel a local port through an EC2 instance that already has the correct security group membership to reach RDS. It leaves no open inbound ports anywhere, produces CloudTrail audit events for every session, and requires no long lived keys. A is a severe violation because it exposes the database to the internet. B is better than A but still dangerous because developer IPs drift over VPN and home networks, and accumulated rules rarely get cleaned up. D is prohibited by [Client] policy and likely by SCPs. C is the only answer that keeps the database private while still giving the developer what they need."
    ),
    33: (
        "Transition from: We just finished the knowledge checks.\n\n"
        "Transition to: Next we'll pull out the key takeaways to remember from this lab.\n\n"
        "Why this is important: A summary of what was actually built is useful both for students' memory and for the inevitable conversation where someone asks them what they learned in training. Making the five-point summary easy to recall turns the lab into a talking point instead of a blur.\n\n"
        "Slide notes: Walk the summary list. Students created an RDS PostgreSQL instance with [Client] configuration, applied mandatory tags and encryption, configured security groups for Lambda to RDS access, connected a Lambda function to a private RDS instance, and verified connectivity through CloudWatch Logs. This is the complete serverless plus managed database pattern.\n\n"
        "Instructor notes: If students ask what's next in their learning journey, the natural progressions are IAM database authentication, Secrets Manager integration, RDS Proxy for connection pooling, and Aurora for higher scale workloads. Each of those builds on the foundations in this lab. CF-103 covers the foundations, more advanced networking and data patterns show up in later streams."
    ),
    34: (
        "Transition from: We just summarized what the lab accomplished.\n\n"
        "Transition to: Next we'll contrast this lab's choices with what production actually requires.\n\n"
        "Why this is important: The five takeaways on this slide are the concepts most likely to show up again in future labs and on the job. Reinforcing them now, when students have just practiced each one, is the highest yield moment to make them stick.\n\n"
        "Slide notes: Walk the five takeaways. Encryption must be enabled at creation and cannot be added later. Private subnets combined with security group references give both network isolation and fine grained access control. Lambda requires VPC configuration and the VPC access execution role policy to reach VPC resources. Security groups that reference each other create self maintaining access rules. Secrets Manager is the production pattern for credentials, not environment variables.\n\n"
        "Instructor notes: Each of these maps directly to a [Client] standard or a common incident root cause. Encryption at creation shows up in every compliance scan. Private subnet plus security group references are the backbone of the [Client] landing zone. The VPC execution role policy is the top Lambda configuration error. Secrets Manager is the answer to the recurring question of how to rotate credentials without breaking production."
    ),
    35: (
        "Transition from: We just covered the key takeaways from the lab.\n\n"
        "Transition to: That wraps up the technical content for Lab 4 and for CF-103's lab track.\n\n"
        "Why this is important: Students often leave labs thinking the lab choices represent production choices, and that's a dangerous assumption for databases. Calling out the differences explicitly is how we prevent a student from copying lab settings into a real [Client] change ticket.\n\n"
        "Slide notes: Walk the five production differences. Multi-AZ is required in production for synchronous replication and automatic failover. Instance classes in production are db.r6g.large or larger, not burstable. Credentials live in Secrets Manager with automatic rotation, not environment variables. IAM database authentication replaces password authentication where the workload supports it. Backup retention is at least fourteen days for production, sometimes longer for compliance-regulated workloads.\n\n"
        "Instructor notes: If a student ever files a change request that says the database will use db.t3.micro with password authentication and seven day backups, the [Client] database review board will reject it immediately. The settings in this lab are for learning the configuration surface, not for production deployment. When students are building real workloads, they should copy the production considerations side of this slide, not the lab side. Advanced topics like RDS Proxy, Aurora Serverless v2, and IAM auth are covered in the intermediate and advanced [Client] streams."
    ),
}

def main():
    with open(TARGET, "r", encoding="utf-8") as f:
        data = json.load(f)

    slides = data["slides"]
    assert len(slides) == 35, f"Expected 35 slides, got {len(slides)}"
    assert len(NOTES) == 35, f"Expected 35 notes entries, got {len(NOTES)}"

    # Sanity: ensure no em-dash or en-dash in any new notes
    for i, note in NOTES.items():
        if "\u2014" in note or "\u2013" in note:
            raise ValueError(f"Dash found in slide {i}")

    for idx, slide in enumerate(slides, start=1):
        slide["speaker_notes"] = NOTES[idx]

    with open(TARGET, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # Report
    layouts = {}
    for s in slides:
        layouts[s["layout"]] = layouts.get(s["layout"], 0) + 1
    print(f"Total slides: {len(slides)}")
    print("Layout distribution:")
    for layout, count in sorted(layouts.items()):
        print(f"  {layout}: {count}")
    # Re-validate JSON
    with open(TARGET, "r", encoding="utf-8") as f:
        json.load(f)
    print("JSON valid")

if __name__ == "__main__":
    main()
