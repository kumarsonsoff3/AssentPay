import type { TablesDB } from "node-appwrite";
import {
  WorkspaceRepository,
  IntegrationRepository,
  type Authorize,
} from "./repositories";
import {
  OAuthStateRepository,
  type OAuthRequest,
  type OAuthBinding,
} from "./oauth-repository";
import {
  currentOperation,
  storageState,
  StorageMaintenanceError,
} from "./coordinator";
import { assertCredentialExecution } from "./credential-execution";
import type { ProfileRecord } from "./model";
import type { IntegrationRecord } from "../integrations/records";
import type { Provider } from "../workspaces/types";
/** Normalized runtime only. Historical onboarding access is operator-only. */
export class RuntimeStore {
  private profiles: WorkspaceRepository;
  private integrations: IntegrationRepository;
  constructor(
    private db: TablesDB,
    private databaseId: string,
    private userId: string,
    private authorize: Authorize,
  ) {
    this.profiles = new WorkspaceRepository(db, databaseId, authorize, userId);
    this.integrations = new IntegrationRepository(
      db,
      databaseId,
      authorize,
      userId,
    );
  }
  private async ready() {
    const state = await storageState();
    if (state.storage !== "normalized" || !state.activated)
      throw new StorageMaintenanceError();
  }
  private async writable() {
    await this.ready();
    if (currentOperation().storage !== "normalized")
      throw new StorageMaintenanceError();
  }
  async profile(workspaceId: string) {
    await this.ready();
    return this.profiles.get(workspaceId);
  }
  async createProfile(
    workspaceId: string,
    profile: ProfileRecord,
    initialize?: (db: TablesDB, tx: string) => Promise<unknown>,
  ) {
    await this.writable();
    return this.profiles.create(workspaceId, profile, initialize);
  }
  async updateProfile(
    workspaceId: string,
    profile: ProfileRecord,
    revision: string,
  ) {
    await this.writable();
    return this.profiles.update(workspaceId, profile, revision);
  }
  async integration(workspaceId: string, provider: Provider) {
    await this.ready();
    return this.integrations.metadata(workspaceId, provider);
  }
  async summaries(workspaceId: string) {
    await this.ready();
    return this.integrations.summaries(workspaceId);
  }
  async execution(workspaceId: string, provider: Provider) {
    assertCredentialExecution();
    await this.ready();
    return this.integrations.readForExecution(workspaceId, provider);
  }
  async saveIntegration(
    workspaceId: string,
    record: IntegrationRecord,
    expectedRevision: string | null,
  ) {
    assertCredentialExecution();
    await this.writable();
    return this.integrations.save(workspaceId, record, expectedRevision);
  }
  async disconnect(workspaceId: string, provider: Provider) {
    await this.writable();
    return this.integrations.disconnect(workspaceId, provider);
  }
  async createOAuth(id: string, value: OAuthRequest) {
    assertCredentialExecution();
    await this.writable();
    return new OAuthStateRepository(
      this.db,
      this.databaseId,
      this.userId,
      this.authorize,
    ).create(id, value);
  }
  async claimOAuth(id: string, expected: OAuthBinding): Promise<OAuthRequest> {
    assertCredentialExecution();
    await this.writable();
    return new OAuthStateRepository(
      this.db,
      this.databaseId,
      this.userId,
      this.authorize,
    ).claim(id, expected);
  }
}
