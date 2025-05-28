# Redis Data Structures for Advanced Lead Management

This document outlines the Redis data structures required for implementing Lead Status Management, Custom Fields for Lead Details, and Lead Scoring within a multi-tenant waitlist system.

## I. Lead Identification and Core Details

These structures focus on uniquely identifying leads and storing their fundamental information.

1.  **`lead:{leadId}:details` (Hash)**
    *   **Description:** Stores core details for a unique lead across all waitlists they might be part of.
    *   **Key:** `lead:{leadId}` (e.g., `lead:l_uuid_12345`)
    *   **Fields:**
        *   `email`: String - The lead's email address (e.g., "user@example.com").
        *   `createdAt`: String - ISO8601 Timestamp of when the lead was first created in the system (e.g., "2023-10-26T10:00:00Z").
        *   `originalWaitlistId`: String - The ID of the waitlist this lead was initially added to (e.g., "wl_uuid_abcde").
        *   `currentStatusId`: String - The ID of the lead's current status, referencing a status definition (e.g., "s_contacted").
        *   `currentScore`: Integer - The lead's current calculated score (e.g., 75).
    *   **Example:**
        ```
        HSET lead:l_uuid_12345 email "user@example.com" createdAt "2023-10-26T10:00:00Z" originalWaitlistId "wl_uuid_abcde" currentStatusId "s_contacted" currentScore 75
        ```

2.  **`waitlist_leads:{waitlistId}` (Set)**
    *   **Description:** Stores a set of unique `leadId`s associated with a specific waitlist. This allows for retrieving all leads for a given waitlist.
    *   **Key:** `waitlist_leads:{waitlistId}` (e.g., `waitlist_leads:wl_uuid_abcde`)
    *   **Members:** `leadId` (e.g., "l_uuid_12345", "l_uuid_67890")
    *   **Example:**
        ```
        SADD waitlist_leads:wl_uuid_abcde "l_uuid_12345" "l_uuid_67890"
        ```

3.  **`email_to_leadId:{waitlistId}:{email}` (String)**
    *   **Description:** Maps an email address to a `leadId` *within the context of a specific waitlist*. This is crucial for de-duplication *per waitlist* if a global lead model (`lead:{leadId}:details`) is also used for cross-waitlist lead identity. If leads are strictly per-waitlist, the `{waitlistId}` part of the key might be redundant if `leadId` itself is generated per waitlist. However, for a system where a lead entity can exist across multiple waitlists, this structure helps find if "user@example.com" is already lead "l_uuid_12345" on "wl_uuid_abcde".
    *   **Key:** `email_to_leadId:{waitlistId}:{normalized_email}` (e.g., `email_to_leadId:wl_uuid_abcde:user@example.com`)
    *   **Value:** `leadId` (e.g., "l_uuid_12345")
    *   **Example:**
        ```
        SET email_to_leadId:wl_uuid_abcde:user@example.com "l_uuid_12345"
        ```
    *   **Note:** The email in the key should be normalized (e.g., lowercase).

## II. Lead Status Management

These structures define and manage the lifecycle statuses a lead can go through within a specific waitlist.

1.  **`waitlist:{waitlistId}:status_definitions` (List)**
    *   **Description:** An ordered list of `statusId`s for a specific waitlist. The order in this list defines the default progression or pipeline sequence of statuses.
    *   **Key:** `waitlist:{waitlistId}:status_definitions` (e.g., `waitlist:wl_uuid_abcde:status_definitions`)
    *   **Values:** `statusId` strings (e.g., "s_new", "s_contacted", "s_qualified", "s_converted")
    *   **Example:**
        ```
        RPUSH waitlist:wl_uuid_abcde:status_definitions "s_new" "s_contacted" "s_qualified"
        ```

2.  **`waitlist:{waitlistId}:status:{statusId}:details` (Hash)**
    *   **Description:** Stores the details for a specific status definition within a waitlist.
    *   **Key:** `waitlist:{waitlistId}:status:{statusId}:details` (e.g., `waitlist:wl_uuid_abcde:status:s_new:details`)
    *   **Fields:**
        *   `name`: String - User-friendly name of the status (e.g., "New Lead", "Contacted").
        *   `color`: String - Hex color code for UI representation (e.g., "#4CAF50", "#2196F3"). Optional.
        *   `order`: Integer - Explicit order of the status within the pipeline. Can be used if List order is not sufficient or for easier reordering without LREM/LINSERT.
    *   **Example:**
        ```
        HMSET waitlist:wl_uuid_abcde:status:s_new:details name "New Lead" color "#4CAF50" order 1
        HMSET waitlist:wl_uuid_abcde:status:s_contacted:details name "Contacted" color "#2196F3" order 2
        ```

## III. Custom Fields for Lead Details

These structures allow users to define custom fields for collecting additional information about leads on a per-waitlist basis.

1.  **`waitlist:{waitlistId}:custom_field_definitions` (Hash)**
    *   **Description:** Stores the definitions of all custom fields for a specific waitlist.
    *   **Key:** `waitlist:{waitlistId}:custom_field_definitions` (e.g., `waitlist:wl_uuid_abcde:custom_field_definitions`)
    *   **Fields (Map keys):** `fieldId` (e.g., "cf_uuid_company", "cf_uuid_interest")
    *   **Values (Map values):** JSON string defining the custom field.
        *   **JSON Structure:**
            *   `name`: String - User-friendly name of the custom field (e.g., "Company Name", "Interest Level").
            *   `type`: String - Type of the field. Supported: "text", "number", "date", "select", "textarea".
            *   `order`: Integer - Order of display in the UI.
            *   `required`: Boolean - Whether the field is mandatory.
            *   `options`: Array of strings (e.g., `["Healthcare", "Finance", "Tech"]`) - Only if `type` is "select".
            *   `placeholder`: String (e.g., "Enter company name") - Optional.
    *   **Example:**
        ```
        HSET waitlist:wl_uuid_abcde:custom_field_definitions "cf_uuid_company" '{"name": "Company Name", "type": "text", "order": 1, "required": false, "placeholder": "Acme Corp"}'
        HSET waitlist:wl_uuid_abcde:custom_field_definitions "cf_uuid_interest" '{"name": "Interest Level", "type": "select", "order": 2, "required": true, "options": ["High", "Medium", "Low"]}'
        ```

2.  **`lead:{leadId}:custom_field_values` (Hash)**
    *   **Description:** Stores the actual values of custom fields for a specific lead. These values correspond to the definitions in `waitlist:{waitlistId}:custom_field_definitions` relevant to the lead's waitlist(s).
    *   **Key:** `lead:{leadId}:custom_field_values` (e.g., `lead:l_uuid_12345:custom_field_values`)
    *   **Fields (Map keys):** `fieldId` (e.g., "cf_uuid_company", "cf_uuid_interest") - This `fieldId` must match one from the relevant waitlist's definitions.
    *   **Values (Map values):** String - The actual value provided by or for the lead. For "date" type, store as ISO8601 date string. For "number", store as string representation.
    *   **Example:**
        ```
        HMSET lead:l_uuid_12345:custom_field_values "cf_uuid_company" "BigCorp Inc." "cf_uuid_interest" "High"
        ```

## IV. Lead Scoring

These structures define rules for scoring leads based on their properties and custom field values. The actual score is stored in `lead:{leadId}:details`.

1.  **`waitlist:{waitlistId}:scoring_rules` (String - storing JSON)**
    *   **Description:** A single key per waitlist storing a JSON string which is an array of all scoring rules for that waitlist.
    *   **Key:** `waitlist:{waitlistId}:scoring_rules` (e.g., `waitlist:wl_uuid_abcde:scoring_rules`)
    *   **Value:** A JSON string representing an array of rule objects.
    *   **Rule Object JSON Structure:**
        *   `ruleId`: String - Unique identifier for the rule (e.g., "rule_uuid_001").
        *   `description`: String - User-friendly description of the rule (e.g., "Company size is 50-100 employees", "Status is Qualified").
        *   `points`: Integer - Points to add or subtract (if negative) when the rule conditions are met.
        *   `conditionGroup`: Object - Defines the conditions for the rule to apply.
            *   `logicalOperator`: String - "AND" or "OR", determining how conditions within the group are evaluated.
            *   `conditions`: Array of condition objects.
                *   **Condition Object JSON Structure:**
                    *   `fieldId`: String - The ID of the field to check. This can be a core lead detail field (e.g., "currentStatusId", "email" - though email might need special handling like domain checking) or a `custom_field_definitions` `fieldId` (e.g., "cf_uuid_company_size").
                    *   `operator`: String - The operator for comparison.
                        *   For text/select: "equals", "not_equals", "contains", "not_contains", "is_set" (exists), "is_not_set" (does not exist).
                        *   For number/date: "equals", "not_equals", "greater_than", "less_than", "greater_than_or_equal_to", "less_than_or_equal_to", "is_set", "is_not_set".
                        *   For email (special): "domain_equals", "domain_not_equals".
                    *   `value`: String/Number/Boolean - The value to compare against. Type should be consistent with the field and operator. For "is_set"/"is_not_set", value might be omitted or ignored.
    *   **Example Value (JSON String):**
        ```json
        [
          {
            "ruleId": "rule_uuid_size",
            "description": "Company size is 50-100",
            "points": 10,
            "conditionGroup": {
              "logicalOperator": "AND",
              "conditions": [
                {
                  "fieldId": "cf_uuid_company_size", // Assuming cf_uuid_company_size is a custom field for "Company Size"
                  "operator": "equals",
                  "value": "50-100"
                }
              ]
            }
          },
          {
            "ruleId": "rule_uuid_status",
            "description": "Lead status is Qualified",
            "points": 20,
            "conditionGroup": {
              "logicalOperator": "AND",
              "conditions": [
                {
                  "fieldId": "currentStatusId",
                  "operator": "equals",
                  "value": "s_qualified"
                }
              ]
            }
          },
          {
            "ruleId": "rule_uuid_no_company_info",
            "description": "No company name provided",
            "points": -5,
            "conditionGroup": {
              "logicalOperator": "AND",
              "conditions": [
                {
                  "fieldId": "cf_uuid_company", // Assuming cf_uuid_company is a custom field for "Company Name"
                  "operator": "is_not_set"
                }
              ]
            }
          }
        ]
        ```
    *   **Redis Command Example:**
        ```
        SET waitlist:wl_uuid_abcde:scoring_rules '[{"ruleId": "rule_uuid_size", ... (rest of JSON string as above)}]'
        ```

---

This document provides a blueprint for the Redis data structures. Further considerations during implementation will include atomicity of operations (using MULTI/EXEC), indexing strategies if Redis Search is used, and data serialization/deserialization logic.
