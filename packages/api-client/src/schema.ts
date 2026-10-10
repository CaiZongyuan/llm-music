// Generated from music-api openapi. Run pnpm client:generate; do not edit.
export interface paths {
    "/connection": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Connection
         * @description Available without a device credential on the known local and LAN listeners; unknown socket bindings are rejected.
         */
        get: operations["connection_connection_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/device": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Current Device
         * @description Legacy compatibility only: validate a submitted Device Bearer credential on either known listener. Direct connection uses /connection and does not call this route.
         */
        get: operations["current_device_device_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pairing/owner": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Pairing Owner
         * @description Only the actual local listener can administer pairing. Device Bearer authorization never grants owner rights.
         */
        get: operations["pairing_owner_pairing_owner_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pairing/challenges": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Challenge
         * @description Only the actual local listener can administer pairing. Device Bearer authorization never grants owner rights. X-Owner-CSRF is required. If Origin is present it must be an allowed local browser Origin; local CLI calls without Origin are supported.
         */
        post: operations["create_challenge_pairing_challenges_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pairing/challenges/current": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Close Challenge
         * @description Only the actual local listener can administer pairing. Device Bearer authorization never grants owner rights. X-Owner-CSRF is required. If Origin is present it must be an allowed local browser Origin; local CLI calls without Origin are supported.
         */
        delete: operations["close_challenge_pairing_challenges_current_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pairing/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Claim Device
         * @description device_id identifies an authorization record. After revocation, explicitly pair with a fresh UUID and token. To recover an uncertain initial claim, replay the exact frozen UUID/token/name/code; a consumed or expired window does not renew credentials.
         *
         *     Available without a device credential on the known local and LAN listeners; unknown socket bindings are rejected.
         */
        post: operations["claim_device_pairing_claim_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pairing/devices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Paired Devices
         * @description Only the actual local listener can administer pairing. Device Bearer authorization never grants owner rights.
         */
        get: operations["paired_devices_pairing_devices_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pairing/devices/{device_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Revoke Device
         * @description Only the actual local listener can administer pairing. Device Bearer authorization never grants owner rights. X-Owner-CSRF is required. If Origin is present it must be an allowed local browser Origin; local CLI calls without Origin are supported.
         */
        delete: operations["revoke_device_pairing_devices__device_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/settings/metadata": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Settings Metadata
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["settings_metadata_settings_metadata_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/runtime/diagnostics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Diagnostics
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["diagnostics_runtime_diagnostics_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Health
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["health_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/runtime/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Capabilities
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["capabilities_runtime_capabilities_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/runtime/models": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Models
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["models_runtime_models_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/requests/{request_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Request
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["get_request_requests__request_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Projects
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["list_projects_projects_get"];
        put?: never;
        /**
         * Create Project
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected. Idempotency-Key must be a UUID for LAN writes and is optional for existing local callers. The same key and validated intent replay the original resource with status 200 before current Runtime readiness/retry checks. A different operation/target/input returns 409. Persist the key and frozen intent before sending; query GET /requests/{request_id} after an uncertain response.
         */
        post: operations["create_project_projects_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Project
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["get_project_projects__project_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/assets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Assets
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["list_assets_projects__project_id__assets_get"];
        put?: never;
        /**
         * Upload Audio
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        post: operations["upload_audio_projects__project_id__assets_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/assets/{asset_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Asset
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["get_asset_projects__project_id__assets__asset_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/assets/{asset_id}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download Asset
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["download_asset_projects__project_id__assets__asset_id__content_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        /**
         * Download Asset
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        head: operations["download_asset_projects__project_id__assets__asset_id__content_head"];
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/transcriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Transcription
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        post: operations["create_transcription_projects__project_id__transcriptions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Jobs
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["list_jobs_projects__project_id__jobs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/jobs/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Job
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["get_job_projects__project_id__jobs__job_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/jobs/{job_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel Job
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        post: operations["cancel_job_projects__project_id__jobs__job_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/jobs/{job_id}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Retry Job
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected. Idempotency-Key must be a UUID for LAN writes and is optional for existing local callers. The same key and validated intent replay the original resource with status 200 before current Runtime readiness/retry checks. A different operation/target/input returns 409. Persist the key and frozen intent before sending; query GET /requests/{request_id} after an uncertain response.
         */
        post: operations["retry_job_projects__project_id__jobs__job_id__retry_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/scores/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Validate Edited Score
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        post: operations["validate_edited_score_projects__project_id__scores_validate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/scores": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Scores
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["list_scores_projects__project_id__scores_get"];
        put?: never;
        /**
         * Create Edited Score
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        post: operations["create_edited_score_projects__project_id__scores_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/scores/{score_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Score
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["get_score_projects__project_id__scores__score_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/jobs/generate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Generate Job
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected. Idempotency-Key must be a UUID for LAN writes and is optional for existing local callers. The same key and validated intent replay the original resource with status 200 before current Runtime readiness/retry checks. A different operation/target/input returns 409. Persist the key and frozen intent before sending; query GET /requests/{request_id} after an uncertain response.
         */
        post: operations["create_generate_job_projects__project_id__jobs_generate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/jobs/generate-from-score": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Generate From Score Job
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        post: operations["create_generate_from_score_job_projects__project_id__jobs_generate_from_score_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/candidates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Candidates
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["list_candidates_projects__project_id__candidates_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/candidates/{candidate_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Candidate
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["get_candidate_projects__project_id__candidates__candidate_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Versions
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["list_versions_projects__project_id__versions_get"];
        put?: never;
        /**
         * Create Version
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        post: operations["create_version_projects__project_id__versions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/versions/{version_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Version
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["get_version_projects__project_id__versions__version_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/reference-audio/from-version": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Reference
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        post: operations["create_reference_projects__project_id__reference_audio_from_version_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/assets/{asset_id}/reference-origin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read Reference Origin
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        get: operations["read_reference_origin_projects__project_id__assets__asset_id__reference_origin_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/cover-inputs/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Validate Cover
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        post: operations["validate_cover_projects__project_id__cover_inputs_validate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{project_id}/jobs/cover": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Cover
         * @description Direct access on known local and explicitly enabled LAN listeners. No PIN or device credential is required, including Asset GET/HEAD/Range. Unknown accepting socket bindings are rejected.
         */
        post: operations["create_cover_projects__project_id__jobs_cover_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** ActiveApplicationJobRead */
        ActiveApplicationJobRead: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Project Id
             * Format: uuid
             */
            project_id: string;
            /**
             * Operation
             * @enum {string}
             */
            operation: "Transcribe" | "Generate" | "GenerateFromScore" | "Cover";
            /**
             * Status
             * @enum {string}
             */
            status: "queued" | "running";
            /** Phase */
            phase: string | null;
            observation: components["schemas"]["DiagnosticSource"];
        };
        /** ApplicationQueueRead */
        ApplicationQueueRead: {
            /**
             * Scope
             * @constant
             */
            scope: "Application persisted active Job states; not native occupancy";
            /** Queued */
            queued: number;
            /** Running */
            running: number;
            /** Jobs */
            jobs: components["schemas"]["ActiveApplicationJobRead"][];
            recorded_running_job: components["schemas"]["DiagnosticValue_str_"];
            observation: components["schemas"]["DiagnosticSource"];
        };
        /** AssetRead */
        AssetRead: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Project Id
             * Format: uuid
             */
            project_id: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "reference_audio" | "score_abc" | "score_midi" | "generated_audio";
            /** Original Name */
            original_name: string;
            /**
             * Format
             * @enum {string}
             */
            format: "wav" | "abc" | "mid" | "flac";
            /** Media Type */
            media_type: string;
            /** Size Bytes */
            size_bytes: number;
            /** Sha256 */
            sha256: string;
            /** Duration Seconds */
            duration_seconds?: number | null;
            /** Channels */
            channels?: number | null;
            /** Sample Rate */
            sample_rate?: number | null;
            /** Sample Width Bits */
            sample_width_bits?: (8 | 16 | 24 | 32) | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** BackendHealthRead */
        BackendHealthRead: {
            /**
             * Status
             * @constant
             */
            status: "ready";
            /**
             * Scope
             * @constant
             */
            scope: "application HTTP process";
            /** Version */
            version: string;
            /** Python Version */
            python_version: string;
            observation: components["schemas"]["DiagnosticSource"];
        };
        /** Body_upload_audio_projects__project_id__assets_post */
        Body_upload_audio_projects__project_id__assets_post: {
            /** File */
            file: Blob;
        };
        /** CandidateRead */
        CandidateRead: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Project Id
             * Format: uuid
             */
            project_id: string;
            /**
             * Job Id
             * Format: uuid
             */
            job_id: string;
            /**
             * Audio Asset Id
             * Format: uuid
             */
            audio_asset_id: string;
            /**
             * Score Id
             * Format: uuid
             */
            score_id: string;
            /** Inputs */
            inputs: components["schemas"]["CoverCreate"] | components["schemas"]["GenerateFromScoreCreate"] | components["schemas"]["GenerateCreate"];
            /** Provenance */
            provenance: {
                [key: string]: unknown;
            };
            /** Output Snapshot */
            output_snapshot: {
                [key: string]: unknown;
            };
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** CapabilitiesRead */
        CapabilitiesRead: {
            /**
             * Mode
             * @enum {string}
             */
            mode: "fake" | "comfyui";
            /**
             * Checked At
             * Format: date-time
             */
            checked_at: string;
            /** Capabilities */
            capabilities: components["schemas"]["CapabilityRead"][];
        };
        /** CapabilityRead */
        CapabilityRead: {
            /**
             * Operation
             * @enum {string}
             */
            operation: "Transcribe" | "Generate" | "GenerateFromScore" | "Cover";
            /** Required Models */
            required_models: string[];
            /** Ready */
            ready: boolean;
            observation: components["schemas"]["DiagnosticSource"];
            /** Reasons */
            reasons: components["schemas"]["DiagnosticReason"][];
            /**
             * Supported Modes
             * @description Observed and declared Cover modes; empty for non-Cover or missing mode choices.
             */
            supported_modes?: ("melody" | "full")[];
        };
        /** ChallengeCreated */
        ChallengeCreated: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Expires At */
            expires_at: number;
            /** Attempts Remaining */
            attempts_remaining: number;
            /**
             * Status
             * @enum {string}
             */
            status: "active" | "closed" | "consumed" | "locked";
            /** Code */
            code: string;
        };
        /** ChallengeRead */
        ChallengeRead: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Expires At */
            expires_at: number;
            /** Attempts Remaining */
            attempts_remaining: number;
            /**
             * Status
             * @enum {string}
             */
            status: "active" | "closed" | "consumed" | "locked";
        };
        /** CodeRegistryRead */
        CodeRegistryRead: {
            /**
             * Component
             * @enum {string}
             */
            component: "runtime" | "plugin";
            /** Expected Revision */
            expected_revision: string;
            /** Code License */
            code_license: string | null;
            /** License Source */
            license_source: string | null;
            /** Registry Source */
            registry_source: string;
        };
        /** ConnectionRead */
        ConnectionRead: {
            /**
             * Server Id
             * Format: uuid
             */
            server_id: string;
            /**
             * Protocol Version
             * @default 1
             * @constant
             */
            protocol_version?: 1;
            /**
             * Access Method
             * @default direct
             * @constant
             */
            access_method?: "direct";
            /** Pairing Available */
            pairing_available: boolean;
            /** Lan Address */
            lan_address: string | null;
        };
        /** CoverCreate */
        CoverCreate: {
            /** Style */
            style: string;
            /** Lyrics */
            lyrics: string;
            /** Seed */
            seed: number;
            /**
             * Max Seconds
             * @description Audio ceiling in seconds; 0 follows the lyrics (the pinned model default).
             * @default 0
             */
            max_seconds?: number;
            /**
             * Abc
             * @description Explicitly selected ABC; copied exactly into the Job input snapshot.
             */
            abc: string;
            /**
             * Source Score Id
             * Format: uuid
             * @description Existing source Score in this Project; edited ABC may differ from its original Asset.
             */
            source_score_id: string;
            /**
             * Parent Version Id
             * @description Optional same-Project Version owning the source Score or retained as its explicit editing parent; retained on Version save.
             */
            parent_version_id?: string | null;
            /**
             * Mode
             * @description Explicit Cover mode: melody omits written chord symbols; full retains them. Both keep the two musical voices.
             * @enum {string}
             */
            mode: "melody" | "full";
            /**
             * Reference Asset Id
             * Format: uuid
             */
            reference_asset_id: string;
            /**
             * Effective Abc Sha256
             * @description Hash of the effective ABC the creator inspected and selected.
             */
            effective_abc_sha256: string;
            /**
             * Mode Transform Version
             * @constant
             */
            mode_transform_version: "1.0.0";
        };
        /** CoverInputValidate */
        CoverInputValidate: {
            /** Abc */
            abc: string;
            /**
             * Mode
             * @enum {string}
             */
            mode: "melody" | "full";
        };
        /** CoverValidationRead */
        CoverValidationRead: {
            /** Note Count */
            note_count: number;
            /** Abc Sha256 */
            abc_sha256: string;
            /** Effective Abc Sha256 */
            effective_abc_sha256: string;
            /** Transformations */
            transformations: string[];
            /** Adapter Version */
            adapter_version: string;
            /** Parser */
            parser: string;
            /** Effective Abc */
            effective_abc: string;
            /**
             * Mode
             * @enum {string}
             */
            mode: "melody" | "full";
            /** Mode Transform Version */
            mode_transform_version: string;
            /** Source Chord Count */
            source_chord_count: number;
            /**
             * Warnings
             * @description full_without_written_chords means full is legal but has no explicit harmony guidance.
             */
            warnings?: string[];
        };
        /** DeviceConnectionRead */
        DeviceConnectionRead: {
            /**
             * Server Id
             * Format: uuid
             */
            server_id: string;
            device: components["schemas"]["DeviceRead"];
        };
        /** DeviceRead */
        DeviceRead: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
            /** Created At */
            created_at: number;
            /** Revoked At */
            revoked_at: number | null;
        };
        /** DiagnosticReason */
        DiagnosticReason: {
            /** Code */
            code: string;
            /** Message */
            message: string;
            /** Recovery */
            recovery: string;
        };
        /** DiagnosticSource */
        DiagnosticSource: {
            /** Source */
            source: string;
            /** Observed At */
            observed_at: string | null;
            /** Age Seconds */
            age_seconds: number | null;
            /**
             * Freshness
             * @enum {string}
             */
            freshness: "fresh" | "stale" | "unavailable";
            /**
             * Max Age Seconds
             * @description Age limit for live observations; null for immutable proof validated against the current process/source/model identity. observed_at retains its original verification time.
             */
            max_age_seconds: number | null;
        };
        /** DiagnosticValue[dict[str, list[str]]] */
        DiagnosticValue_dict_str__list_str___: {
            /** Value */
            value: {
                [key: string]: string[];
            } | null;
            /**
             * Availability
             * @enum {string}
             */
            availability: "available" | "unavailable";
            observation: components["schemas"]["DiagnosticSource"];
            /** Reasons */
            reasons: components["schemas"]["DiagnosticReason"][];
        };
        /** DiagnosticValue[int] */
        DiagnosticValue_int_: {
            /** Value */
            value: number | null;
            /**
             * Availability
             * @enum {string}
             */
            availability: "available" | "unavailable";
            observation: components["schemas"]["DiagnosticSource"];
            /** Reasons */
            reasons: components["schemas"]["DiagnosticReason"][];
        };
        /** DiagnosticValue[list[str]] */
        DiagnosticValue_list_str__: {
            /** Value */
            value: string[] | null;
            /**
             * Availability
             * @enum {string}
             */
            availability: "available" | "unavailable";
            observation: components["schemas"]["DiagnosticSource"];
            /** Reasons */
            reasons: components["schemas"]["DiagnosticReason"][];
        };
        /** DiagnosticValue[str] */
        DiagnosticValue_str_: {
            /** Value */
            value: string | null;
            /**
             * Availability
             * @enum {string}
             */
            availability: "available" | "unavailable";
            observation: components["schemas"]["DiagnosticSource"];
            /** Reasons */
            reasons: components["schemas"]["DiagnosticReason"][];
        };
        /** DiagnosticsRead */
        DiagnosticsRead: {
            /**
             * Mode
             * @enum {string}
             */
            mode: "fake" | "comfyui";
            /**
             * Checked At
             * Format: date-time
             */
            checked_at: string;
            /** Source Observations */
            source_observations: {
                [key: string]: components["schemas"]["DiagnosticSource"];
            };
            gpu_name: components["schemas"]["DiagnosticValue_str_"];
            /** Versions */
            versions: {
                [key: string]: components["schemas"]["DiagnosticValue_str_"];
            };
            /** Memory */
            memory: components["schemas"]["MemoryMetricRead"][];
            loaded_models: components["schemas"]["DiagnosticValue_list_str__"];
            generic_model_inventory: components["schemas"]["DiagnosticValue_dict_str__list_str___"];
            application_queue: components["schemas"]["ApplicationQueueRead"];
            native_queue_occupancy: components["schemas"]["DiagnosticValue_int_"];
        };
        /** ErrorDetail */
        ErrorDetail: {
            /** Code */
            code: string;
            /** Message */
            message: string;
            /** Recovery */
            recovery: string;
            /** Resource Id */
            resource_id?: string | null;
        };
        /** ErrorResponse */
        ErrorResponse: {
            error: components["schemas"]["ErrorDetail"];
        };
        /** GenerateCreate */
        GenerateCreate: {
            /** Style */
            style: string;
            /** Lyrics */
            lyrics: string;
            /** Seed */
            seed: number;
            /**
             * Max Seconds
             * @description Audio ceiling in seconds; 0 follows the lyrics (the pinned model default).
             * @default 0
             */
            max_seconds?: number;
        };
        /** GenerateFromScoreCreate */
        GenerateFromScoreCreate: {
            /** Style */
            style: string;
            /** Lyrics */
            lyrics: string;
            /** Seed */
            seed: number;
            /**
             * Max Seconds
             * @description Audio ceiling in seconds; 0 follows the lyrics (the pinned model default).
             * @default 0
             */
            max_seconds?: number;
            /**
             * Abc
             * @description Explicitly selected ABC; copied exactly into the Job input snapshot.
             */
            abc: string;
            /**
             * Source Score Id
             * Format: uuid
             * @description Existing source Score in this Project; edited ABC may differ from its original Asset.
             */
            source_score_id: string;
            /**
             * Parent Version Id
             * @description Optional same-Project Version owning the source Score or retained as its explicit editing parent; retained on Version save.
             */
            parent_version_id?: string | null;
        };
        /** HealthRead */
        HealthRead: {
            /**
             * Checked At
             * Format: date-time
             */
            checked_at: string;
            backend: components["schemas"]["BackendHealthRead"];
            runtime: components["schemas"]["RuntimeHealthRead"];
        };
        /** JobRead */
        JobRead: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Project Id
             * Format: uuid
             */
            project_id: string;
            /**
             * Operation
             * @enum {string}
             */
            operation: "Transcribe" | "Generate" | "GenerateFromScore" | "Cover";
            /**
             * Status
             * @enum {string}
             */
            status: "queued" | "running" | "completed" | "failed" | "cancelled";
            /** Phase */
            phase: string | null;
            /** Progress */
            progress?: number | null;
            /** Inputs */
            inputs: {
                [key: string]: unknown;
            };
            /** Provenance */
            provenance: {
                [key: string]: unknown;
            };
            /** Error */
            error: {
                [key: string]: unknown;
            } | null;
            /** Result */
            result: {
                [key: string]: string;
            } | null;
            /** Recovery Required */
            recovery_required: boolean;
            /**
             * Cancel Requested
             * @default false
             */
            cancel_requested?: boolean;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        JsonValue: unknown;
        /** MemoryMetricRead */
        MemoryMetricRead: {
            /** Value */
            value: number | null;
            /**
             * Availability
             * @enum {string}
             */
            availability: "available" | "unavailable";
            observation: components["schemas"]["DiagnosticSource"];
            /** Reasons */
            reasons: components["schemas"]["DiagnosticReason"][];
            /** Name */
            name: string;
            /** Scope */
            scope: string;
            /**
             * Unit
             * @constant
             */
            unit: "bytes";
        };
        /** ModelRead */
        ModelRead: {
            /** Id */
            id: string;
            /** Name */
            name: string;
            /** Provider */
            provider: string;
            /** Repository */
            repository: string;
            /** Revision */
            revision: string;
            /** Filename */
            filename: string;
            /** Local Path */
            local_path: string;
            /** Registry Source */
            registry_source: string;
            /** Hash Source */
            hash_source: string;
            /** Components */
            components: string[];
            /** Component License Notes */
            component_license_notes: string | null;
            /** Expected Sha256 */
            expected_sha256: string;
            /** Expected Size Bytes */
            expected_size_bytes: number;
            /** Weights License */
            weights_license: string;
            /** License Source */
            license_source: string;
            /**
             * State
             * @enum {string}
             */
            state: "missing" | "downloading" | "ready" | "invalid" | "unavailable";
            /** Observed Sha256 */
            observed_sha256: string | null;
            observation: components["schemas"]["DiagnosticSource"];
            /** Reasons */
            reasons: components["schemas"]["DiagnosticReason"][];
        };
        /** ModelsRead */
        ModelsRead: {
            /**
             * Mode
             * @enum {string}
             */
            mode: "fake" | "comfyui";
            /**
             * Checked At
             * Format: date-time
             */
            checked_at: string;
            /** Code Registry */
            code_registry: components["schemas"]["CodeRegistryRead"][];
            /** Models */
            models: components["schemas"]["ModelRead"][];
        };
        /** OwnerRead */
        OwnerRead: {
            /**
             * Server Id
             * Format: uuid
             */
            server_id: string;
            /** Owner Csrf */
            owner_csrf: string;
            /** Lan Address */
            lan_address: string | null;
            challenge: components["schemas"]["ChallengeRead"] | null;
        };
        /** PairingClaim */
        PairingClaim: {
            /**
             * Device Id
             * Format: uuid
             */
            device_id: string;
            /**
             * Device Token
             * @description 32 securely generated random bytes encoded as exactly 64 lowercase hex characters.
             */
            device_token: string;
            /** Device Name */
            device_name: string;
            /** Code */
            code: string;
        };
        /** ProjectCreate */
        ProjectCreate: {
            /** Name */
            name: string;
            /**
             * Description
             * @default
             */
            description?: string;
        };
        /** ProjectRead */
        ProjectRead: {
            /** Name */
            name: string;
            /**
             * Description
             * @default
             */
            description?: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** ReferenceOriginRead */
        ReferenceOriginRead: {
            /**
             * Reference Asset Id
             * Format: uuid
             */
            reference_asset_id: string;
            /**
             * Source Version Id
             * Format: uuid
             */
            source_version_id: string;
            /**
             * Source Asset Id
             * Format: uuid
             */
            source_asset_id: string;
            /** Source Sha256 */
            source_sha256: string;
            /** Start Frame */
            start_frame: number;
            /** Frame Count */
            frame_count: number;
            /** Sample Rate */
            sample_rate: number;
            /** Derivation Version */
            derivation_version: string;
        };
        /** RequestRead */
        RequestRead: {
            /**
             * Request Id
             * Format: uuid
             */
            request_id: string;
            /**
             * Operation
             * @enum {string}
             */
            operation: "create_project" | "generate" | "retry";
            /**
             * Project Id
             * Format: uuid
             */
            project_id: string;
            /**
             * Resource Type
             * @enum {string}
             */
            resource_type: "project" | "job";
            /**
             * Resource Id
             * Format: uuid
             */
            resource_id: string;
            /** Source Job Id */
            source_job_id: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** RuntimeHealthRead */
        RuntimeHealthRead: {
            /**
             * Mode
             * @enum {string}
             */
            mode: "fake" | "comfyui";
            /**
             * Status
             * @enum {string}
             */
            status: "ready" | "not_ready" | "unavailable";
            /** Reachable */
            reachable: boolean;
            /** Ready */
            ready: boolean;
            /** Binding Verified */
            binding_verified: boolean | null;
            observation: components["schemas"]["DiagnosticSource"];
            /** Reasons */
            reasons: components["schemas"]["DiagnosticReason"][];
        };
        /** ScoreCreate */
        ScoreCreate: {
            /** Abc */
            abc: string;
            /**
             * Save Id
             * Format: uuid
             * @description Stable save-intent id. Repeating identical input returns the same immutable Score.
             */
            save_id?: string;
            /**
             * Source Score Id
             * @description Optional source Score in this Project; its files remain immutable.
             */
            source_score_id?: string | null;
            /**
             * Parent Version Id
             * @description Optional Version owning the source Score, or its retained editing parent.
             */
            parent_version_id?: string | null;
        };
        /** ScoreRead */
        ScoreRead: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Project Id
             * Format: uuid
             */
            project_id: string;
            /** Job Id */
            job_id: string | null;
            /**
             * Abc Asset Id
             * Format: uuid
             */
            abc_asset_id: string;
            /** Source Reference Asset Id */
            source_reference_asset_id: string | null;
            /** Source Score Id */
            source_score_id: string | null;
            /** Parent Version Id */
            parent_version_id: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** ScoreValidate */
        ScoreValidate: {
            /** Abc */
            abc: string;
        };
        /** ScoreValidationRead */
        ScoreValidationRead: {
            /** Note Count */
            note_count: number;
            /** Abc Sha256 */
            abc_sha256: string;
            /** Effective Abc Sha256 */
            effective_abc_sha256: string;
            /** Transformations */
            transformations: string[];
            /** Adapter Version */
            adapter_version: string;
            /** Parser */
            parser: string;
        };
        /** SettingsMetadataRead */
        SettingsMetadataRead: {
            /**
             * Source
             * @constant
             */
            source: "music_api.config.Settings.model_json_schema";
            /** Environment Prefix */
            environment_prefix: string;
            /** Environment Variables */
            environment_variables: {
                [key: string]: string;
            };
            /** Settings Schema */
            settings_schema: {
                [key: string]: components["schemas"]["JsonValue"];
            };
        };
        /** TranscribeCreate */
        TranscribeCreate: {
            /**
             * Reference Asset Id
             * Format: uuid
             */
            reference_asset_id: string;
        };
        /** VersionRead */
        VersionRead: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Project Id
             * Format: uuid
             */
            project_id: string;
            /**
             * Job Id
             * Format: uuid
             */
            job_id: string;
            /**
             * Audio Asset Id
             * Format: uuid
             */
            audio_asset_id: string;
            /**
             * Score Id
             * Format: uuid
             */
            score_id: string;
            /** Inputs */
            inputs: components["schemas"]["CoverCreate"] | components["schemas"]["GenerateFromScoreCreate"] | components["schemas"]["GenerateCreate"];
            /** Provenance */
            provenance: {
                [key: string]: unknown;
            };
            /** Output Snapshot */
            output_snapshot: {
                [key: string]: unknown;
            };
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Candidate Id
             * Format: uuid
             */
            candidate_id: string;
            /** Name */
            name: string;
            /** Parent Version Id */
            parent_version_id: string | null;
        };
        /** VersionReferenceCreate */
        VersionReferenceCreate: {
            /**
             * Source Version Id
             * Format: uuid
             */
            source_version_id: string;
            /**
             * Save Id
             * Format: uuid
             * @description Immutable Reference save intent. Identical replay returns the same first16s PCM WAV.
             */
            save_id?: string;
        };
        /** VersionSave */
        VersionSave: {
            /**
             * Candidate Id
             * Format: uuid
             */
            candidate_id: string;
            /** Name */
            name: string;
            /**
             * Parent Version Id
             * @description Generate may choose a same-Project parent. GenerateFromScore retains its submitted parent when omitted and rejects a different parent.
             */
            parent_version_id?: string | null;
        };
        /** JobEventRead */
        JobEventRead: {
            /**
             * Type
             * @default job.updated
             * @constant
             */
            type?: "job.updated";
            /** Sequence */
            sequence: number;
            job: components["schemas"]["JobRead"];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    connection_connection_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConnectionRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    current_device_device_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeviceConnectionRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    pairing_owner_pairing_owner_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OwnerRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    create_challenge_pairing_challenges_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChallengeCreated"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    close_challenge_pairing_challenges_current_delete: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    claim_device_pairing_claim_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PairingClaim"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeviceConnectionRead"];
                };
            };
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeviceConnectionRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Gone */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    paired_devices_pairing_devices_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeviceRead"][];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    revoke_device_pairing_devices__device_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                device_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeviceRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    settings_metadata_settings_metadata_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SettingsMetadataRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    diagnostics_runtime_diagnostics_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DiagnosticsRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    health_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    capabilities_runtime_capabilities_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CapabilitiesRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    models_runtime_models_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ModelsRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_request_requests__request_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RequestRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    list_projects_projects_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectRead"][];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    create_project_projects_post: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProjectCreate"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectRead"];
                };
            };
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_project_projects__project_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    list_assets_projects__project_id__assets_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssetRead"][];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    upload_audio_projects__project_id__assets_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_upload_audio_projects__project_id__assets_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssetRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request Entity Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_asset_projects__project_id__assets__asset_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
                asset_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssetRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    download_asset_projects__project_id__assets__asset_id__content_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
                asset_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "audio/wav": string;
                    "audio/flac": string;
                    "text/vnd.abc": string;
                    "audio/midi": string;
                };
            };
            /** @description Requested original bytes (including multipart ranges). */
            206: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "audio/wav": string;
                    "audio/flac": string;
                    "text/vnd.abc": string;
                    "audio/midi": string;
                    "multipart/byteranges": string;
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unsatisfiable byte range from FileResponse. */
            416: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": string;
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    download_asset_projects__project_id__assets__asset_id__content_head: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
                asset_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Original Asset headers without a response body. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Original Asset range headers without a response body. */
            206: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unsatisfiable byte range; FileResponse returns no bytes for HEAD. */
            416: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    create_transcription_projects__project_id__transcriptions_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TranscribeCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    list_jobs_projects__project_id__jobs_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobRead"][];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_job_projects__project_id__jobs__job_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    cancel_job_projects__project_id__jobs__job_id__cancel_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobRead"];
                };
            };
            /** @description Accepted */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    retry_job_projects__project_id__jobs__job_id__retry_post: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string | null;
            };
            path: {
                project_id: string;
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobRead"];
                };
            };
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    validate_edited_score_projects__project_id__scores_validate_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ScoreValidate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScoreValidationRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    list_scores_projects__project_id__scores_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScoreRead"][];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    create_edited_score_projects__project_id__scores_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ScoreCreate"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScoreRead"];
                };
            };
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScoreRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_score_projects__project_id__scores__score_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
                score_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ScoreRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    create_generate_job_projects__project_id__jobs_generate_post: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string | null;
            };
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GenerateCreate"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobRead"];
                };
            };
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    create_generate_from_score_job_projects__project_id__jobs_generate_from_score_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GenerateFromScoreCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    list_candidates_projects__project_id__candidates_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CandidateRead"][];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_candidate_projects__project_id__candidates__candidate_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
                candidate_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CandidateRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    list_versions_projects__project_id__versions_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VersionRead"][];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    create_version_projects__project_id__versions_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VersionSave"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VersionRead"];
                };
            };
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VersionRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_version_projects__project_id__versions__version_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
                version_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VersionRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    create_reference_projects__project_id__reference_audio_from_version_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VersionReferenceCreate"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssetRead"];
                };
            };
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssetRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    read_reference_origin_projects__project_id__assets__asset_id__reference_origin_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
                asset_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReferenceOriginRead"] | null;
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    validate_cover_projects__project_id__cover_inputs_validate_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CoverInputValidate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CoverValidationRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    create_cover_projects__project_id__jobs_cover_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CoverCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobRead"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable Entity */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
}

export const jobEventsPath = "/projects/{project_id}/jobs/{job_id}/events" as const;
