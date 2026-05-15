#!/usr/bin/env python3
"""Rewrite speaker_notes for every slide in CF-102 Chapter 4 JSON.
ONLY modifies speaker_notes. All other fields untouched.
"""
import json
from pathlib import Path

TARGET = Path(r"I:/My Drive/CourseCreationKit/courses/SYF/stream1_cloud_foundations/CF-102_Cloud_Security/slide_json/CF-102_Chapter_4_roi_slides.json")

# New speaker_notes keyed by slide index (0-based)
NEW_NOTES = {
    # 0 - Title slide (plain)
    0: "Welcome to Chapter 4. We're shifting from AWS security services to their Azure counterparts. [Client] operates in both clouds, so knowing the Azure side is not optional for anyone who works across environments. Ask the room who works primarily in Azure and who has touched Entra ID before, so you can calibrate the depth of the discussion.",

    # 1 - Chapter Objectives (plain)
    1: "Walk the room through the four objectives. By the end of the chapter they should be able to navigate Entra ID and RBAC, configure NSGs, use Azure Monitor and Activity Log and Policy, and apply [Client]'s Azure-specific guardrails. These objectives mirror Chapter 3 but the services behave very differently in places, and those differences are where engineers get burned.",

    # 2 - Chapter Concepts (navigation, row 0)
    2: "Here is the roadmap for the chapter. We start with identity in Entra ID and RBAC, which is the foundation everything else depends on. Point at the highlighted row to show where we are now.",

    # 3 - Azure Security Services Overview (full)
    3: (
        "Transition from: We just previewed the chapter agenda, so the room knows we are starting with a services overview.\n\n"
        "Transition to: Once the landscape is clear, we drop into Entra ID itself, which is the first service on this list.\n\n"
        "Why this is important: New engineers often try to find an Azure equivalent for every AWS service one to one, and that mental model breaks quickly. Seeing the five services side by side here lets people anchor on what each one actually owns before we go deep.\n\n"
        "Slide notes: Walk through each bullet. Entra ID owns identity, both authentication and authorization, and it reaches far beyond Azure resources into Microsoft 365 and third party SaaS. NSGs are the network traffic control at subnet and NIC level. Azure Monitor collects metrics and logs. Activity Log is the control plane audit trail. Azure Policy enforces governance, and it can actively block deployments, not just report on them. Call out that these five services together are the approved Azure security stack at [Client], plus Defender for Cloud for posture management.\n\n"
        "Instructor notes: The AWS mappings people usually reach for are: Entra ID to IAM plus Cognito plus AWS SSO, NSG to Security Group plus some NACL behavior, Azure Monitor to CloudWatch, Activity Log to CloudTrail management events, Azure Policy to AWS Config plus SCPs. None of those are exact. Azure Policy in particular is more active than Config because it can deny creation at the management plane. If a student asks about Defender for Cloud, it is the closest parallel to AWS Security Hub plus GuardDuty, and [Client] has it enabled for posture management."
    ),

    # 4 - What Is Azure AD / Entra ID? (full)
    4: (
        "Transition from: We just laid out the five Azure security services we are covering in this chapter.\n\n"
        "Transition to: Next we break Entra ID into its component parts so the naming lines up with what students will see in the portal.\n\n"
        "Why this is important: Entra ID is the front door to every Azure resource [Client] owns, plus Microsoft 365, plus anything federated through it. A misconfiguration here is not a one account problem, it is a tenant wide problem. That is why we spend real time on it.\n\n"
        "Slide notes: Walk the bullets. Entra ID is cloud based identity and access management. Microsoft rebranded Azure AD to Microsoft Entra ID, and both names are still in use in the portal, in docs, and on this slide deliberately. It is a directory service, so users, groups, and applications live here. It supports SSO, MFA, and Conditional Access out of the box. Mention that at [Client] this is the corporate identity provider, the same identity students use to log into their work laptop is the identity that authenticates to the Azure portal.\n\n"
        "Instructor notes: The rebrand from Azure AD to Microsoft Entra ID happened in mid 2023. The service is identical, only the name changed. CLI commands still use az ad for most operations. Entra ID is tenant scoped, which means one Entra ID tenant can govern many Azure subscriptions. That is a sharp contrast to AWS IAM, which is account scoped. If a student asks about federation, Entra ID speaks SAML 2.0, OIDC, and WS-Federation natively, where AWS IAM needs IAM Identity Center or a third party to do the same thing."
    ),

    # 5 - Azure AD Components (full, table)
    5: (
        "Transition from: We just defined Entra ID at the service level.\n\n"
        "Transition to: Once these four identity types are clear, we can move to RBAC, which is how each of them actually gets permissions.\n\n"
        "Why this is important: Pick the wrong identity type and you either over permission a workload or create credentials you have to manage forever. Managed identities in particular eliminate an entire class of secret handling bugs, and [Client] prefers them for that reason.\n\n"
        "Slide notes: Walk each row. Users are individual humans, and because Entra ID is a full directory they carry rich attributes like manager, department, and office. Groups are collections of users, and Entra ID supports dynamic membership, so a group can be defined as all users in Engineering and membership updates automatically. Service principals are application identities, created when you register an app. Managed identities are the preferred pattern for Azure resource to Azure resource authentication because Azure manages the credential lifecycle for you.\n\n"
        "Instructor notes: The AWS mapping is users to IAM users, groups to IAM groups, service principals to IAM roles for applications, and managed identities to IAM roles for services. The key teaching point is to always reach for managed identity first. A VM that needs to read a secret from Key Vault should use its system assigned managed identity, not a service principal with a client secret. If a student asks how managed identity works under the covers, Azure gives the VM a token via the Instance Metadata Service at 169.254.169.254, the same address AWS uses for IMDS, which is a helpful parallel."
    ),

    # 6 - Azure RBAC Overview (full)
    6: (
        "Transition from: We just covered the four identity types in Entra ID.\n\n"
        "Transition to: Next we look at the scope hierarchy, which is where RBAC assignments live and inherit.\n\n"
        "Why this is important: RBAC is where the actual permission decisions happen in Azure, and the model is genuinely different from AWS IAM policies. Students who try to translate an IAM policy into RBAC one to one will get confused, so we need to reset the mental model here.\n\n"
        "Slide notes: The formula on the slide is the whole thing. Who plus What plus Where. The Who is a security principal, so a user, group, service principal, or managed identity. The What is a role, either built in or custom. The Where is a scope, which can be management group, subscription, resource group, or individual resource. Owner, Contributor, and Reader are the three built in roles people use daily. Inheritance flows down, so a role granted at subscription scope applies to every resource group and resource inside.\n\n"
        "Instructor notes: In AWS IAM, policies attach directly to identities and specify Actions and Resources inside the policy document. In Azure RBAC, the role definition defines Actions, and the scope is specified separately at assignment time. That means the same role can be assigned at different scopes to different people. There are over 200 built in roles. Custom roles are written as JSON with Actions, NotActions, and AssignableScopes. The most common mistake is picking Contributor when Reader would suffice, and we will reinforce that throughout the chapter."
    ),

    # 7 - Azure RBAC Scope Hierarchy (full, table)
    7: (
        "Transition from: We just walked the Who plus What plus Where formula for RBAC assignments.\n\n"
        "Transition to: With the hierarchy clear, we will look at the specific built in roles students will use most often.\n\n"
        "Why this is important: Scope choice is the single biggest lever for blast radius in Azure. The same Contributor role at subscription scope is enormous, at resource group scope it is reasonable, and at individual resource scope it is narrow. Teaching people to reach for the smallest scope that works is the goal of this slide.\n\n"
        "Slide notes: Walk the table top to bottom. Management groups are the broadest scope and organize subscriptions at enterprise scale. Subscriptions are the main billing and governance boundary, and most real role assignments happen at or below this level. Resource groups are logical containers, and granting Contributor at resource group is a very common [Client] pattern so a team can manage their own resources without touching anyone else's. Individual resources are the narrowest scope, useful for fine grained cases like a read only grant on one storage account. Emphasize that assignments flow down and cannot be blocked by a lower scope.\n\n"
        "Instructor notes: There is no equivalent of an explicit deny that overrides inheritance in standard RBAC. If someone has Contributor at subscription scope, you cannot revoke their access to one resource group by assigning something lower. You have to remove or narrow the subscription scope assignment. Azure does have deny assignments, but they are created by Azure Blueprints and managed resources, not by regular users. At [Client], production subscriptions are kept lean at the subscription level specifically to avoid this trap. Privileged role assignments go through PIM, which we cover a few slides later."
    ),

    # 8 - Common Azure RBAC Roles (full, table)
    8: (
        "Transition from: We just walked the scope hierarchy from management group down to individual resource.\n\n"
        "Transition to: Next we will see the CLI command that actually creates a role assignment.\n\n"
        "Why this is important: These four roles cover almost everything a student will do day to day. Knowing the exact difference between Contributor and Owner, and when Reader is enough, is the difference between a safe [Client] deployment and an over permissioned one.\n\n"
        "Slide notes: Walk the four roles. Owner is full access plus the ability to grant access to others, which is why it is the most dangerous role. Use it sparingly, and at [Client] subscription Owner is only available through PIM activation. Contributor is the workhorse, full control over resources but cannot change role assignments. Reader is view only, perfect for auditors, monitoring tools, and developers who need to look at production without touching it. User Access Administrator can manage RBAC but cannot touch resources, which is useful for delegating access management to a team lead.\n\n"
        "Instructor notes: The Actions and NotActions inside each role definition are what make this work. Contributor has wildcard Action but NotActions on Microsoft.Authorization/write and elevateAccess, which is how it blocks role assignment. User Access Administrator is the inverse, it has Microsoft.Authorization write access but nothing on the resource providers. If someone needs the ability to grant access but not change resources, User Access Administrator is the cleanest answer. Warn the room that assigning Contributor just because it is the default choice is one of the most common over permissioning mistakes in Azure."
    ),

    # 9 - Assigning an Azure RBAC Role (code, full)
    9: (
        "Transition from: We just defined the four roles students will see most, Owner, Contributor, Reader, and User Access Administrator.\n\n"
        "Transition to: Next we turn from RBAC to Entra ID best practices, including MFA, Conditional Access, and PIM.\n\n"
        "Why this is important: This is the command engineers actually run, in the CLI or in a pipeline. Seeing it in one line makes the three part Who plus What plus Where model concrete.\n\n"
        "Slide notes: Read through the command left to right. The assignee flag takes an email, object ID, or service principal app ID, so anything that identifies the security principal works. The role flag takes the role name exactly as it appears in Azure, including spaces, which is why it is quoted. The scope flag is the full ARM resource ID of the target, in this case a resource group under a subscription. After running this, the user can create, modify, and delete resources inside my-rg but cannot reach any other resource group, cannot grant access to anyone else, and cannot touch the subscription itself.\n\n"
        "Instructor notes: Verify an assignment with az role assignment list --assignee user@company.com. You can also scope the list by --scope to see only assignments at a specific level. If the assignee is a service principal, pass the appId or objectId instead of an email. At [Client], role assignments in production flow through the standard access request system, so this exact command is rarely run by hand in production, but it shows up constantly in Bicep and Terraform. If a student asks about denying access, remember RBAC has no explicit deny in standard assignments, so the way to revoke is to remove the assignment at the scope where it was granted."
    ),

    # 10 - Azure AD Best Practices (full)
    10: (
        "Transition from: We just ran through the CLI command that creates an RBAC role assignment.\n\n"
        "Transition to: Next the deck pivots to network controls with NSGs, now that identity is settled.\n\n"
        "Why this is important: Most Azure incidents the [Client] security team investigates trace back to one of these five practices being skipped. Permanent Owner at subscription scope, no MFA on a service account, a service principal with a leaked client secret, Conditional Access turned off for convenience. Each bullet here is a real failure pattern.\n\n"
        "Slide notes: Walk each practice. MFA for all users is the floor, and security defaults in Entra ID enable it on new tenants by default. Conditional Access layers on top, letting us require MFA only when risk is elevated, or block legacy authentication entirely. Privileged Identity Management makes sensitive roles just in time, so Owner at subscription scope is activated for a few hours and then expires. Managed identities eliminate the service principal client secret problem entirely. Access reviews close the loop by periodically asking whether each sensitive assignment is still needed.\n\n"
        "Instructor notes: At [Client] PIM is mandatory for privileged roles at subscription scope, and access reviews run quarterly for sensitive assignments. Conditional Access policies are managed through the Microsoft Graph API, not the standard az CLI, so if students ask why az ad has limited Conditional Access commands, that is why. Legacy authentication means protocols like IMAP, POP, and older Exchange Web Services endpoints that do not support MFA, and blocking them is one of the single highest leverage security moves available. If a student asks about service principals versus managed identities, the rule of thumb is managed identity when the caller is an Azure resource, service principal only when the caller lives outside Azure, like a GitHub Actions workflow."
    ),

    # 11 - Chapter Concepts (navigation, row 1)
    11: "We are moving from identity to network controls. Point at the highlighted row so the room can orient. The next several slides cover NSGs, including how they differ from AWS Security Groups in ways that trip up cross cloud engineers.",

    # 12 - What Are Network Security Groups? (full)
    12: (
        "Transition from: We just finished the Entra ID best practices, wrapping up the identity section.\n\n"
        "Transition to: Next we line NSGs up directly against AWS Security Groups so the differences are explicit.\n\n"
        "Why this is important: NSGs look like Security Groups at first glance, and that surface similarity is a trap. The priority model, the deny rule support, and the default allow inside a VNet are all different, and engineers who assume AWS semantics make real mistakes here.\n\n"
        "Slide notes: Walk the bullets. An NSG is a virtual firewall containing security rules for inbound and outbound traffic. It can be associated with a subnet, a NIC, or both at once for defense in depth. Rules have explicit priority numbers from 100 to 4096, and lower numbers are evaluated first. First match wins, so once a rule matches traffic, evaluation stops. NSGs are stateful, so return traffic for an allowed flow is automatically permitted without a matching outbound rule.\n\n"
        "Instructor notes: The first match wins model is the biggest behavioral difference from AWS. In AWS Security Groups, every rule is evaluated and the most permissive match applies, and there is no such thing as a deny rule. In Azure NSGs, you can place a deny rule at priority 100 and it will beat an allow at priority 200 every time. When troubleshooting, the single most useful question is, what is the priority of the rule that is actually matching this traffic. Azure provides NSG flow logs and the effective security rules view in the portal to answer that question. If both subnet and NIC level NSGs are attached, both must allow the traffic for it to pass."
    ),

    # 13 - NSG vs AWS Security Groups (full, table)
    13: (
        "Transition from: We just introduced NSGs at the concept level.\n\n"
        "Transition to: Next we walk through the exact CLI command to add a rule.\n\n"
        "Why this is important: [Client] engineers routinely build in both clouds, and the silent assumption that AWS semantics apply is how subnets end up with unintended open traffic. This table is a quick reference for that translation.\n\n"
        "Slide notes: Walk each row. Association, NSGs attach to subnets or NICs, AWS Security Groups only attach to ENIs. For subnet level control in AWS, you have to use NACLs, which are stateless. Priority, NSG rules have explicit priority 100 to 4096, AWS evaluates every rule. Deny rules, NSGs support explicit deny, AWS Security Groups do not. Default rules, NSGs allow VNet traffic by default, AWS Security Groups deny all inbound by default. Statefulness, both are stateful, which is the one thing that matches.\n\n"
        "Instructor notes: The default rule difference is the single biggest gotcha. In AWS, if you do nothing, nothing can reach your instance. In Azure, if you do nothing and the resource is in a VNet, every other resource in that VNet can reach every port on it. For micro segmentation inside a VNet you must add explicit deny rules. Application Security Groups, ASGs, are Azure's answer to referencing a Security Group as a source in AWS. They let you write rules like allow from web-tier ASG to app-tier ASG without hard coding IP ranges. If a student asks about NACLs, Azure does not have a direct equivalent, subnet level NSGs fill that role and they are stateful, which is actually cleaner than AWS NACLs."
    ),

    # 14 - Creating an NSG Rule (code, full)
    14: (
        "Transition from: We just compared Azure NSGs to AWS Security Groups feature by feature.\n\n"
        "Transition to: Next we look at the six default rules that come baked into every NSG.\n\n"
        "Why this is important: This is the command students will run or commit to Bicep and Terraform. Reading it slowly here means they understand what each flag does before they see it in production code.\n\n"
        "Slide notes: Walk the command top to bottom. The nsg-name and resource-group identify the target. The name is a human readable label, and we name rules descriptively so future engineers can tell why they exist. Priority 100 puts this rule near the top of evaluation. Source address prefix 10.0.0.0/8 restricts this rule to internal traffic only. Destination port 443 limits it to HTTPS. Access Allow and Protocol Tcp complete the rule. The effect is, TCP 443 from any 10 dot address is allowed in, and anything else still falls through to the default deny.\n\n"
        "Instructor notes: Priority numbers should be spaced out intentionally. Starting at 100 and leaving gaps like 200, 300, 400 lets you insert rules later without renumbering. If traffic is not flowing as expected, check three things in order. First, both subnet and NIC level NSGs, since both must allow. Second, the effective security rules view to see what is actually being evaluated. Third, service level firewalls like the Azure SQL firewall, which sit on top of NSGs. Service tags like VirtualNetwork, Internet, and AzureLoadBalancer can be used in place of IP ranges for common sources, and [Client] uses them heavily for anything touching Azure managed services."
    ),

    # 15 - NSG Default Rules (full)
    15: (
        "Transition from: We just saw the CLI command to create a custom NSG rule.\n\n"
        "Transition to: Next we consolidate this into a set of NSG best practices for [Client] environments.\n\n"
        "Why this is important: Every NSG ships with six rules baked in that cannot be deleted. Understanding them is non negotiable because they are the implicit behavior underneath everything a student configures on top.\n\n"
        "Slide notes: Walk each default rule. AllowVnetInBound at priority 65000 allows all traffic between resources in the same VNet, which is the default allow we keep warning about. AllowAzureLoadBalancerInBound at 65001 permits Azure's health probes, and blocking it breaks load balanced services. DenyAllInBound at 65500 catches everything that did not match an earlier rule. On the outbound side, AllowVnetOutBound lets VNet resources reach each other, AllowInternetOutBound lets resources reach the public internet, and DenyAllOutBound closes the door on anything else. Custom rules must use priorities below 65000 to override these.\n\n"
        "Instructor notes: Because AllowVnetInBound allows all ports within the VNet, achieving micro segmentation requires adding explicit deny rules at lower priority numbers. This is the opposite of AWS, where you start with nothing and add allows. AllowInternetOutBound is also significant, Azure VMs can reach the internet by default, which surprises engineers coming from AWS where egress is freely allowed too, but not for data plane services. If [Client] wants to restrict outbound to specific destinations, you add deny rules or route traffic through Azure Firewall or a third party appliance. The default rules cannot be deleted but they can be overridden by any custom rule at a lower priority number."
    ),

    # 16 - NSG Best Practices (full)
    16: (
        "Transition from: We just walked through the six default rules that every NSG inherits.\n\n"
        "Transition to: Next we close out the NSG section and move to Azure Monitor and the Activity Log.\n\n"
        "Why this is important: These five practices are the ones the [Client] cloud security team looks for in any Azure review. Getting them right up front saves weeks of remediation work later.\n\n"
        "Slide notes: Walk the bullets. Associate NSGs with subnets rather than NICs whenever possible, it is more consistent and easier to audit. Use Application Security Groups to group resources by function so rules reference ASG names instead of IP ranges. Put deny rules at low priority numbers so they are evaluated first, particularly for known bad IPs. Document every rule with a descriptive name and a meaningful description field, because future troubleshooting depends on knowing why the rule exists. Review rules on a schedule and remove anything tied to decommissioned applications.\n\n"
        "Instructor notes: [Client] has an Azure Policy that requires every subnet to have an NSG associated, and deployments without one will be denied or flagged. Subnet level NSGs are strongly preferred because they provide consistent protection regardless of what resource is deployed in the subnet. NIC level NSGs should be reserved for cases where one VM in a subnet genuinely needs different rules than its neighbors. ASGs only work within a single region, so if students ask about cross region references, the answer is service tags or explicit IP ranges. A common audit finding is rules with source Any on management ports like 22 or 3389, and the fix is to require Azure Bastion or a specific corporate IP range."
    ),

    # 17 - Chapter Concepts (navigation, row 2)
    17: "We are leaving network controls behind and moving into monitoring and auditing. Point at the highlighted row. The next four slides cover Azure Monitor, the Activity Log, and how KQL fits in for investigation work.",

    # 18 - What Is Azure Monitor? (full)
    18: (
        "Transition from: We just wrapped up NSG best practices, closing out the network section.\n\n"
        "Transition to: Next we look at the four Azure Monitor components side by side.\n\n"
        "Why this is important: Without monitoring, the [Client] operations team cannot detect problems, investigate incidents, or produce audit evidence. Azure Monitor is the umbrella, and knowing which piece of it to reach for in which situation is a daily skill.\n\n"
        "Slide notes: Walk the bullets. Azure Monitor is the comprehensive monitoring service for Azure. It collects metrics, which are numeric time series, logs, which are structured event data, and traces for distributed applications. It enables alerting and visualization through dashboards and workbooks. It integrates with Log Analytics workspaces, which is where all the log data actually lives and gets queried. It supports Kusto Query Language, KQL, for expressive querying across logs.\n\n"
        "Instructor notes: KQL is different from SQL and different from CloudWatch Logs Insights. It takes a session to get comfortable, but once you have it, it is significantly more expressive than its AWS counterpart. Metrics are retained for 93 days by default, logs are retained based on the Log Analytics workspace configuration, which at [Client] is typically 90 days hot plus longer term archive. Application Insights is the APM piece and slots into Azure Monitor for distributed tracing. If a student asks how to send Linux or Windows VM logs to Azure Monitor, the answer is the Azure Monitor Agent plus a data collection rule, which is the successor to the older Log Analytics agent."
    ),

    # 19 - Azure Monitor Components (full, table)
    19: (
        "Transition from: We just described Azure Monitor as the umbrella over metrics, logs, alerts, and workbooks.\n\n"
        "Transition to: Next we look at the Activity Log specifically, which is where control plane operations are recorded.\n\n"
        "Why this is important: Each component has a different strength, and picking the wrong one is how people end up writing expensive log queries for data that should have been a metric alert. This table puts the boundaries in one place.\n\n"
        "Slide notes: Walk each row. Metrics are fast, near real time, and cheap, ideal for dashboards and operational alerts like CPU above 90 percent for five minutes. Logs are rich and searchable, with the full event context, which is what you need for investigation. Alerts connect both metrics and logs to action, either notification or automation through Action Groups. Workbooks are interactive reports, more powerful than simple dashboards, with drill down, filtering, and parameterized queries.\n\n"
        "Instructor notes: Day to day operational work leans on metrics and alerts. Incident investigation leans on logs and KQL. Reporting to stakeholders and leadership leans on workbooks. The Action Groups tied to alerts can notify by email, SMS, voice, or push, or they can fire a Logic App, webhook, Automation runbook, or ITSM ticket, which is how [Client] integrates with ServiceNow. If a student asks about cost, metrics are essentially free at the basic resolution, log ingestion to Log Analytics is priced by the gigabyte, so the cost lever is always which logs are actually being ingested."
    ),

    # 20 - What Is Azure Activity Log? (full)
    20: (
        "Transition from: We just walked the four Azure Monitor components and when to reach for each.\n\n"
        "Transition to: Next we look at the actual CLI command to query Activity Log events.\n\n"
        "Why this is important: Activity Log is the answer to the question, who did what in this subscription. For incident response, forensics, and compliance, this is the first log a [Client] investigator will pull. Not knowing it exists is an audit finding waiting to happen.\n\n"
        "Slide notes: Walk the bullets. Activity Log is subscription level and it records control plane events, so resource creation, modification, deletion, role assignments, policy evaluations, and service health. Each event records who, what, when, and result. Default retention is 90 days, which is short for many [Client] compliance requirements, so events get exported to Log Analytics or a storage account for longer retention. It is roughly the Azure equivalent of CloudTrail management events, with the same distinction between control plane and data plane.\n\n"
        "Instructor notes: Activity Log does not capture data plane operations, things like reading an object from a storage account or executing a query against a database. Those require diagnostic settings on the specific resource. The eight Activity Log event categories are Administrative, Service Health, Resource Health, Alert, Autoscale, Recommendation, Security, and Policy. At [Client] Activity Log is piped to a central Log Analytics workspace, and the SOC monitors it for suspicious patterns like mass deletions, unexpected role changes, or policy exemption creation. If a student asks why they cannot find a delete event, the two common causes are the event is older than 90 days and was not exported, or the event is a data plane operation and was never in Activity Log to begin with."
    ),

    # 21 - Querying Activity Log Events (code, full)
    21: (
        "Transition from: We just defined the Activity Log as the control plane audit trail.\n\n"
        "Transition to: Next we pivot to Azure Policy and Key Vault, which together handle governance and secrets.\n\n"
        "Why this is important: This is the exact command a [Client] engineer runs during an incident when the question is who deleted the production VM. Walking through it slowly gives students the muscle memory to use it under pressure.\n\n"
        "Slide notes: Read through the command. The resource-group flag narrows the scope so we are not sifting the whole subscription. The start-time and end-time flags define the search window, and they accept ISO dates. The query flag uses JMESPath and filters to VM delete operations specifically. The output shows the caller, the timestamp, the operation name, and the result. Point out that this single command answers the most common forensic question in ninety percent of incidents.\n\n"
        "Instructor notes: For anything more complex than a single filter, switch to Log Analytics and KQL. The KQL equivalent is AzureActivity filter on OperationNameValue contains delete, project the fields you want, and it is dramatically faster across larger time ranges. At [Client] the SOC has pre built workbooks for common queries, so incident responders rarely write raw KQL, but knowing how it works helps them read the workbook output. If a student asks about non Azure delete events, CloudTrail style, remember Activity Log is Azure only, you need to join it with other sources in the SIEM for a full picture. Also flag that 90 day default retention, if you cannot find an event, check whether Activity Log export to Log Analytics was configured at the time."
    ),

    # 22 - Chapter Concepts (navigation, row 3)
    22: "We are moving into governance enforcement with Azure Policy, then wrapping up with Key Vault for secrets management. Point at the highlighted row so the room can see where we are in the chapter.",

    # 23 - What Is Azure Policy? (full)
    23: (
        "Transition from: We just saw how to pull events out of the Activity Log for investigation.\n\n"
        "Transition to: Next we look specifically at the policy effects, because picking the right effect is what makes policy useful.\n\n"
        "Why this is important: Azure Policy is how [Client] actually enforces security standards. Many of the guardrails students hit during deployment, like private endpoints being required or certain regions being denied, are Azure Policies in action. Understanding how they work removes the mystery when a deployment fails.\n\n"
        "Slide notes: Walk the bullets. Azure Policy is the governance service that evaluates resources against policy definitions. There are hundreds of built in policies covering security, compliance, and operational best practices. Custom policies can be written in JSON for [Client] specific needs. Policy effects range from Audit, which only logs non compliance, to Deny, which actively blocks the deployment, to Modify and DeployIfNotExists, which actually change or create resources to make them compliant. This is more active than AWS Config, which reports but does not prevent.\n\n"
        "Instructor notes: The comparison people reach for is AWS Config, which is reporting based, and AWS Service Control Policies, which are deny only at the organization level. Azure Policy has both reporting and active prevention in one service. Policies are grouped into initiatives, formerly called policy sets, which let [Client] treat a bundle of related policies as one unit. Policy evaluation happens on a trigger, so resource create, update, or a scheduled scan. If a student asks why their deployment failed, the Activity Log event will include the policy that denied it and the exact reason. Policy exemptions exist but require governance team approval at [Client]."
    ),

    # 24 - Azure Policy Effects (full)
    24: (
        "Transition from: We just introduced Azure Policy at the service level.\n\n"
        "Transition to: Next we move to Key Vault, which is where the secrets policy is going to enforce live.\n\n"
        "Why this is important: The effect you pick determines whether a policy is a safety net or a paperwork exercise. Audit is observational, Deny stops the deployment, and DeployIfNotExists can actually save the team from themselves. Picking wrong means either breaking production with a premature Deny or having zero enforcement with a stuck Audit.\n\n"
        "Slide notes: Walk each effect. Deny is the strongest, it blocks non compliant deployments at creation or update time. Audit logs non compliance but allows the resource, used when you are rolling out a requirement and want to see the impact before enforcing. Append adds properties to a resource, such as required tags. Modify changes existing properties on a resource, useful for auto remediation. DeployIfNotExists deploys a related resource if it does not already exist, which is how [Client] guarantees diagnostic settings on critical resources.\n\n"
        "Instructor notes: The typical [Client] rollout pattern is Audit first to measure current non compliance, then remediate the existing violations, then flip the policy to Deny. This prevents the scenario where a new Deny policy breaks every deployment on Monday morning because nobody had visibility into the existing state. DeployIfNotExists requires a managed identity on the policy assignment so it has permission to create the related resource, which is a common stumbling block when the policy appears to do nothing. Modify uses operations like addOrReplace and remove, and is the effect used for auto tagging missing resources. Disabled is the sixth effect, which simply turns the policy off, useful during testing."
    ),

    # 25 - What Is Azure Key Vault? (full)
    25: (
        "Transition from: We just walked the five main Azure Policy effects.\n\n"
        "Transition to: Next we look at the three object types Key Vault actually holds.\n\n"
        "Why this is important: Secrets are the number one root cause of cloud breaches across the industry, and at [Client] the rule is categorical, no secrets in code, config, or environment variables. Key Vault is how we comply with that rule, and every engineer needs to know it cold.\n\n"
        "Slide notes: Walk the bullets. Key Vault is centralized secrets management for Azure, covering keys, secrets, and certificates in one service. It is backed by HSMs for the highest security tier. Access is controlled through RBAC, the newer model, or Key Vault access policies, the legacy model. It integrates with nearly every Azure service, so resources like App Service, Function Apps, AKS, and VMs can pull secrets at runtime via managed identity.\n\n"
        "Instructor notes: Key Vault is the combination of AWS Secrets Manager for secrets and AWS KMS for keys plus AWS Certificate Manager for certificates, all in one service. At [Client] we prefer the RBAC access model over access policies because it aligns with the rest of Azure RBAC, and Key Vault access policies are being phased out in guidance. Soft delete is enabled by default now, which gives you a 7 to 90 day recovery window if something is accidentally deleted. Purge protection on top of soft delete blocks even administrators from permanently deleting during the retention window. Both are required at [Client]. Private endpoints are also required for Key Vault specifically, which we reinforce in the guardrails section."
    ),

    # 26 - Key Vault Object Types (full, table)
    26: (
        "Transition from: We just defined Key Vault at the service level.\n\n"
        "Transition to: Next we see the exact CLI command to store a secret, which is the command engineers run most often.\n\n"
        "Why this is important: Putting keys, secrets, and certificates in the right object type is not just semantic. Each type has different access rules, different rotation patterns, and different integrations. Getting it wrong makes automation harder and audits messier.\n\n"
        "Slide notes: Walk the three types. Keys are for cryptographic operations like encrypting a storage account with a customer managed key. The key material never leaves the vault, so encrypt and decrypt happen through the vault API. Secrets are arbitrary strings up to 25KB, which covers database passwords, connection strings, API keys, and most ad hoc sensitive values. Certificates are X.509 certificates with full lifecycle management, so Key Vault can generate, renew, and deploy TLS certs automatically, often integrating with App Service or Application Gateway for hands free renewal.\n\n"
        "Instructor notes: A common mistake is storing cryptographic key material as a secret instead of as a key. It works, but you lose the HSM protection and the key never leaves the vault guarantee, because now the application retrieves the raw bytes. Use the key object type for anything that needs to be used for encryption or signing. Certificates in Key Vault actually create an entry in all three stores, the certificate itself, the private key as a key, and the certificate information as a secret. This is unintuitive but it is how integrations like App Service pull the full cert chain. At [Client] certs are typically issued by the internal CA and imported, not generated inside Key Vault."
    ),

    # 27 - Storing a Secret in Key Vault (code, full)
    27: (
        "Transition from: We just covered the three Key Vault object types, keys, secrets, and certificates.\n\n"
        "Transition to: Next we move to the [Client] specific guardrails section, where the policy enforcement rubber meets the road.\n\n"
        "Why this is important: This is the exact command students will see in examples, ad hoc ops work, and sometimes pipeline setup. Showing the command has a big warning attached is part of the lesson, because the wrong hands on this command in the wrong place is a secret leak.\n\n"
        "Slide notes: Read the command. Vault name points to the Key Vault. Name is the secret name, which is what applications reference at runtime. Value is the actual secret, and this is where the warning lives, never put a real secret on a command line that could be captured in shell history, logged, or committed. Retrieval is the symmetric command, az keyvault secret show with the same vault and name, returning the value via the query flag.\n\n"
        "Instructor notes: In real [Client] workflows, secrets are rarely set by hand. They come from the internal CA for certs, from managed identity federation for pipeline tokens, or from a secret rotation job. When they are set manually, use the CLI in interactive mode or read from a file with the --file flag, not the --value flag on the command line. Applications should use the Key Vault SDK with managed identity, not shell out to az. Cross reference with the version control warning, a secret in a committed script is a secret leak even if the script is deleted in the next commit, because git history preserves it. [Client] secret scanning will catch these, but it is easier not to commit them."
    ),

    # 28 - Chapter Concepts (navigation, row 4)
    28: "We are in the final stretch. The last section covers [Client] specific Azure guardrails, including the approved services list, disallowed services, and the private endpoints requirement that is the most important Azure control we enforce. Point at the highlighted row.",

    # 29 - Synchrony Approved Azure Security Services (full)
    29: (
        "Transition from: We just finished Key Vault and the core Azure security services.\n\n"
        "Transition to: Next we cover the services that are explicitly not approved at [Client], which is just as important.\n\n"
        "Why this is important: Students will plan projects, and they need to know which services they can reach for without a security review. Starting a project with a disallowed service and finding out three weeks in is painful for everyone.\n\n"
        "Slide notes: Walk each approved service. Defender for Cloud is [Client]'s primary security posture management tool for Azure, required on production subscriptions, providing recommendations, secure score, and threat detection. Key Vault is required for all secrets management, no exceptions, and must use private endpoints. Azure Monitor is required for logging and metrics, with diagnostic settings configured to the central Log Analytics workspace. Azure Policy is used extensively to enforce governance, and many requirements show up as policies that deny non compliant deployments.\n\n"
        "Instructor notes: If a student asks about Azure Sentinel, which is Microsoft's SIEM product, it is under evaluation at [Client] but not approved for broad use yet. Defender for Cloud includes threat detection plans for servers, storage, SQL, Key Vault, App Service, and containers, and [Client] has the relevant plans enabled. The cost of Defender plans is non trivial, so subscription owners should know which plans are enabled. For any Azure security service not on this list, the answer is always talk to cloud security first, never assume a service is available just because it exists in the Azure catalog."
    ),

    # 30 - Synchrony Disallowed Azure Services (full)
    30: (
        "Transition from: We just covered the approved Azure security services at [Client].\n\n"
        "Transition to: Next we hit the guardrails, the non negotiable requirements that Azure Policy enforces.\n\n"
        "Why this is important: Knowing what is disallowed up front saves weeks of rework. These are the services where engineers most often assume approval and then discover at deployment time that policy is blocking them.\n\n"
        "Slide notes: Walk each disallowed category. Azure SQL Database is not approved, if relational database is needed, engage cloud security for alternatives like Aurora or RDS on the AWS side. Cosmos DB is not approved, if NoSQL is needed, discuss requirements with cloud security. Other Azure database services follow the same rule, not approved without review. Azure Machine Learning services are not approved, any AI or ML workload has specific requirements that engage a separate team. The underlying principle is, before starting a project, verify the services you plan to use are on the approved list.\n\n"
        "Instructor notes: The why behind restrictions varies by service. Some have not completed security review. Some do not fit [Client]'s architecture patterns, like DynamoDB and Cosmos DB being outside the data architecture. Some have compliance challenges specific to PCI or SOX. Restrictions change over time, so always check current guidance rather than relying on slide decks. If a student pushes back, the answer is cloud security owns the approval decision, and the path forward is to engage them early with a specific business need, not to deploy and hope. Many restrictions can be lifted with proper review, but surprise deployments that violate policy are the worst possible outcome."
    ),

    # 31 - Synchrony Azure Security Guardrails (full)
    31: (
        "Transition from: We just listed the Azure services that are not approved at [Client].\n\n"
        "Transition to: Next we double down on the most important guardrail, private connectivity, because it deserves its own slide.\n\n"
        "Why this is important: These five guardrails are not suggestions, they are technical controls enforced by Azure Policy. If a deployment fails because one of these is violated, the fix is to address the compliance issue, not to bypass or exempt the policy. Understanding them up front turns deployment failures into expected behavior rather than surprises.\n\n"
        "Slide notes: Walk each guardrail. Private endpoints are required for every PaaS service that handles data. Public endpoints must be disabled, not just bypassed, because having a private endpoint with the public one still open does not reduce the attack surface. NSGs are required on every subnet, enforced by policy. Azure Policy enforces compliance standards across the full catalog of [Client] requirements. Encryption is required for all data at rest, with customer managed keys for sensitive workloads.\n\n"
        "Instructor notes: Private endpoints give a PaaS service a private IP address inside a VNet, routing traffic over the Microsoft backbone instead of the public internet. The combination required is private endpoint plus public network access disabled. Just adding the private endpoint and leaving the public one open gives no security benefit. NSG requirement policy is DeployIfNotExists in some cases and Deny in others, depending on the subscription. Customer managed keys for sensitive workloads means the key lives in [Client]'s Key Vault and Azure services use it to encrypt, which gives [Client] the ability to revoke the key and effectively cryptoshred the data if needed. PCI-DSS is a major driver for most of these, and that is worth mentioning if students ask why."
    ),

    # 32 - Emphasis: Private Connectivity in Azure (full)
    32: (
        "Transition from: We just walked the five [Client] guardrails, including the private endpoint requirement.\n\n"
        "Transition to: Next we move into best practices and common pitfalls before the knowledge check.\n\n"
        "Why this is important: This single guardrail is the most common Azure security issue the [Client] cloud security team investigates. Azure defaults to public in a way AWS does not, and engineers trained on AWS repeatedly assume privacy where there is none. This slide is the mental reset.\n\n"
        "Slide notes: Walk the bullets. Azure PaaS services have public endpoints by default, so a brand new storage account or Key Vault is reachable from the internet until you explicitly lock it down. Private endpoints give these services private IPs inside the VNet and route traffic over the Microsoft backbone. They are required for [Client] security compliance. The full technical details of configuration are covered in CF-104 Azure Networking. For sensitive workloads, especially anything touching cardholder data or PII, this is a hard requirement.\n\n"
        "Instructor notes: The risk without private endpoints is not just credential brute force, it is the entire public attack surface of the service, including any vulnerability in the service itself. For PCI-DSS, cardholder data environments must be isolated from the public internet, and public PaaS endpoints fail that test. The deploy first, add private endpoints later pattern leaves a window of exposure between creation and lockdown that [Client] does not tolerate. Every PaaS resource should be deployed with private endpoints configured in the same Bicep or Terraform template, not as a follow up. If a student asks about storage account firewall rules as an alternative, firewall rules are trusted services and IP ranges, they do not eliminate the public endpoint, private endpoints do."
    ),

    # 33 - Best Practices (full)
    33: (
        "Transition from: We just emphasized why private endpoints are the top [Client] Azure guardrail.\n\n"
        "Transition to: Next we flip the same list around and look at what goes wrong in practice.\n\n"
        "Why this is important: These five practices come up in almost every [Client] Azure review. Engineers who build these habits from day one avoid the majority of the issues that otherwise show up as audit findings months later.\n\n"
        "Slide notes: Walk the bullets. Managed identities over service principals, because Azure handles the credential lifecycle and there is nothing to rotate or leak. Defender for Cloud recommendations, enable it and actually work the recommendations, not just glance at the secure score. Key Vault for all secrets, no hard coding anywhere in code, config files, or pipeline variables. Azure Policy for compliance enforcement, understand the policies that apply to your resources so you can deploy inside them rather than fighting them. Private endpoints from day one, configured in the initial deployment template, not added later.\n\n"
        "Instructor notes: The pattern across all five is, make the secure path the default path. Managed identity is the default identity pattern, Key Vault is the default secrets pattern, private endpoints are the default network pattern. When security is the default, engineers do not have to remember to choose it under deadline pressure. Defender for Cloud recommendations that are left unaddressed for too long eventually become audit findings, so [Client] tracks remediation SLAs on them. If a student asks about cost optimization, managed identities are free, Key Vault access is cheap, private endpoints have a per hour cost that is worth building into project budgets."
    ),

    # 34 - Common Pitfalls (full)
    34: (
        "Transition from: We just covered the five best practices that prevent most Azure security issues.\n\n"
        "Transition to: Next we put it to the test with a knowledge check on identity and access.\n\n"
        "Why this is important: These are not theoretical. Every pitfall on this slide is a real failure pattern the [Client] security team has investigated. Recognizing them in your own work before they become incidents is the point of this chapter.\n\n"
        "Slide notes: Walk the bullets. Permanent Owner at subscription scope is the biggest blast radius problem, solved by PIM for just in time activation. Leaving default NSG rules unchanged means intra VNet traffic is wide open, which breaks micro segmentation assumptions. Not enabling diagnostic settings means resources run with no logging, creating blind spots during incidents. Secrets in code, config, or environment variables is the classic root cause of breaches, solved by Key Vault plus managed identity. Assuming Azure resources are private by default is the AWS trained mistake, and the fix is to assume public until you have verified private endpoints plus public access disabled.\n\n"
        "Instructor notes: The pattern the students should take away is, most Azure security issues come from applying AWS mental models to Azure without checking. AWS trains engineers to expect private by default, deny first, no cross tenant access. Azure often inverts those defaults. Recognizing when you are on autopilot and explicitly re checking is the skill. The diagnostic settings pitfall is worth a beat, because without them, Activity Log only covers control plane, and you will be blind on data plane operations like storage reads or SQL queries when an incident hits. Enable diagnostic settings on every critical resource, and use DeployIfNotExists policies to guarantee it automatically."
    ),

    # 35 - Knowledge Check 1 (full KC)
    35: (
        "Transition from: We just finished the list of common pitfalls that the [Client] security team sees most.\n\n"
        "Transition to: After the second knowledge check, we move into the hands on exercise where students apply this material.\n\n"
        "Why this is important: This question tests whether students actually internalized the PIM plus least privilege plus least scope pattern. If they miss this, they will over permission contractors in real projects and create audit findings.\n\n"
        "Slide notes: Read the scenario out loud. A contractor needs Contributor access to one resource group for two weeks. Pause and let the room think for a moment before going through the options. Option A is wrong because subscription scope violates least privilege and manual cleanup is unreliable. Option B is wrong because shared credentials break individual accountability and violate SOX and PCI requirements for unique identities. Option C is correct because PIM provides just in time activation, the Contributor role is scoped to just the one resource group, and the assignment automatically expires after two weeks with a full audit trail. Option D is wrong because Owner includes the ability to grant access to others, which a contractor should never have.\n\n"
        "Instructor notes: If students gravitate toward Option A, the teaching point is that manual cleanup always fails eventually, someone leaves or forgets, and the [Client] environment has real examples of stale contractor access from months after projects ended. If they gravitate toward Option B, emphasize that shared credentials make it impossible to answer the question who did this during an incident. PIM is mandatory at [Client] for privileged assignments at subscription scope, and strongly preferred at resource group scope for temporary access. The full [Client] pattern for this scenario is, invite as B2B guest, assign Reader or Contributor via PIM, scope to the resource group, time bound to two weeks, with Conditional Access requiring MFA, and diagnostic settings capturing activity."
    ),

    # 36 - Knowledge Check 2 (full KC)
    36: (
        "Transition from: We just worked through the contractor access knowledge check.\n\n"
        "Transition to: Next we transition to the hands on exercise to apply all of this material in the portal.\n\n"
        "Why this is important: This question tests whether students really understand the NSG default rules, specifically AllowVnetInBound. Engineers who miss this build VNets that they think are segmented but are actually wide open at the network layer.\n\n"
        "Slide notes: Read the scenario out loud, a custom rule at priority 200 allowing TCP 443 from 10.0.0.0/8, and the default AllowVnetInBound at 65000 allowing all VNet traffic. The question is why can VMs in the same VNet reach each other on all ports. Pause for the room to think. Option A is wrong because the priority 200 rule only matches TCP 443, not other ports. Option B is wrong because statefulness only allows return traffic for an already allowed flow, it does not open unrelated ports. Option C is correct, the default AllowVnetInBound rule at priority 65000 allows all intra VNet traffic and explicit deny rules are needed to restrict it. Option D is wrong, NSGs absolutely support port level filtering within a VNet.\n\n"
        "Instructor notes: The behavior on Option C is the key AWS to Azure difference. AWS Security Groups deny all inbound by default, Azure NSGs allow all intra VNet traffic by default. For micro segmentation inside a VNet, you add explicit deny rules at priority below 65000, like a deny at 4000 that blocks everything not matched by earlier allows. If a student argues Option A, walk through the first match wins evaluation model, priority 200 evaluates before 65000 but only for traffic matching its criteria, and traffic not matching falls through to continue evaluation. This is the single most useful NSG mental model to reinforce."
    ),

    # 37 - Hands-On Exercise (full, demo)
    37: (
        "Transition from: We just worked through both knowledge checks on identity and NSG behavior.\n\n"
        "Transition to: After the exercise, we close the chapter with the summary and look ahead to encryption and network security.\n\n"
        "Why this is important: Reading about RBAC and NSGs is not the same as actually running the queries. Twenty minutes of guided practice in the portal locks the concepts in and surfaces questions that will not come up from slides alone. This is also where [Client] specific findings tend to show up.\n\n"
        "Slide notes: Walk the four exercises. Exercise one, RBAC assignments, use the portal or az role assignment list to review who has Owner or Contributor in a subscription, and at what scope. Exercise two, NSG rules, find NSGs in the environment and look for overly permissive access like source Any on management ports. Exercise three, Activity Log, navigate to a resource group's Activity Log and practice filtering by operation and caller. Exercise four, storage encryption, verify encryption is enabled, check for customer managed keys where required, and confirm private endpoints are configured. Document findings using the [Client] security template. Plan for about 20 minutes, and circulate to answer questions.\n\n"
        "Instructor notes: Expected outcomes, students should identify at least one over permissioned assignment, one NSG rule worth tightening, one Activity Log event that explains a recent change, and one storage account either fully locked down or with a gap to flag. Prep required, students need access to a [Client] sandbox or lab subscription with Reader or higher, and a shared [Client] security review template for documenting findings. If any student cannot access the sandbox, pair them with someone who can, or drive a demo from the front. The portal paths are Azure Portal then Subscriptions then Access control IAM for RBAC, Network Security Groups under Networking, Monitor then Activity log for Activity Log, and Storage accounts then Encryption and Networking for storage. No GitHub repo for this exercise, everything runs in the portal."
    ),

    # 38 - Chapter Summary (plain)
    38: "Recap the four objectives from the chapter opening, identity via Entra ID and RBAC, network control via NSGs, visibility via Azure Monitor and Activity Log and Azure Policy, and the [Client] guardrails that culminate in the private endpoints requirement. Remind the room that the next chapter goes deeper on encryption and network security across both AWS and Azure, and invite questions before moving on.",
}


def main():
    data = json.loads(TARGET.read_text(encoding="utf-8"))
    slides = data["slides"]
    assert len(slides) == len(NEW_NOTES), f"Slide count mismatch: JSON has {len(slides)}, notes dict has {len(NEW_NOTES)}"

    # Snapshot other fields per slide for verification
    snapshots = []
    for i, s in enumerate(slides):
        snap = {k: v for k, v in s.items() if k != "speaker_notes"}
        snapshots.append(snap)

    # Apply new notes, touching ONLY speaker_notes
    for i, slide in enumerate(slides):
        slide["speaker_notes"] = NEW_NOTES[i]

    # Verify no other field changed
    for i, slide in enumerate(slides):
        snap = snapshots[i]
        current = {k: v for k, v in slide.items() if k != "speaker_notes"}
        if current != snap:
            raise RuntimeError(f"Slide {i} had a non-speaker_notes field change!")
        # Also verify same keys present
        expected_keys = set(snap.keys()) | {"speaker_notes"}
        actual_keys = set(slide.keys())
        if expected_keys != actual_keys:
            raise RuntimeError(f"Slide {i} key set mismatch: {actual_keys} vs {expected_keys}")

    # Write back, preserving formatting
    TARGET.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Updated {len(slides)} slides.")

    # Validate final JSON by re-parsing
    reparsed = json.loads(TARGET.read_text(encoding="utf-8"))
    assert len(reparsed["slides"]) == 39, "Post-write slide count wrong"
    print("JSON validated after write.")


if __name__ == "__main__":
    main()
