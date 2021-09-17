import { basename } from "path";
import { extensions, Uri, ExtensionContext } from "vscode";
import { Folders, WORKSPACE_PLACEHOLDER } from "../commands/Folders";
import { SETTINGS_CONTENT_FOLDERS, SETTINGS_CONTENT_PAGE_FOLDERS, SETTING_DATE_FIELD, SETTING_MODIFIED_FIELD, SETTING_SEO_DESCRIPTION_FIELD, SETTING_TAXONOMY_CONTENT_TYPES } from "../constants";
import { DEFAULT_CONTENT_TYPE_NAME } from "../constants/ContentType";
import { EXTENSION_BETA_ID, EXTENSION_ID, EXTENSION_STATE_VERSION } from "../constants/Extension";
import { ContentType } from "../models";
import { Notifications } from "./Notifications";
import { Settings } from "./SettingsHelper";


export class Extension {
  private static instance: Extension;
  
  private constructor(private ctx: ExtensionContext) {}

  /**
   * Creates the singleton instance for the panel
   * @param extPath 
   */
  public static getInstance(ctx?: ExtensionContext): Extension {
    if (!Extension.instance && ctx) {
      Extension.instance = new Extension(ctx);
    }

    return Extension.instance;
  }

  /**
   * Get the current version information for the extension
   */
  public getVersion(): { usedVersion: string | undefined, installedVersion: string } {
    const frontMatter = extensions.getExtension(this.isBetaVersion() ? EXTENSION_BETA_ID : EXTENSION_ID)!;
    let installedVersion = frontMatter.packageJSON.version;
    const usedVersion = this.ctx.globalState.get<string>(EXTENSION_STATE_VERSION);
    
    if (this.isBetaVersion()) {
      installedVersion = `${installedVersion}-beta`;
    }

    if (!usedVersion) {
      this.setVersion(installedVersion);
    };

    return {
      usedVersion,
      installedVersion
    };
  }

  /**
   * Set the current version information for the extension
   */
  public setVersion(installedVersion: string): void {
    this.ctx.globalState.update(EXTENSION_STATE_VERSION, installedVersion);
  }

  /**
   * Get the path to the extension
   */
  public get extensionPath(): Uri {
    return this.ctx.extensionUri;
  }

  /**
   * Migrate old settings to new settings
   */
  public async migrateSettings(): Promise<void> {
    const config = Settings.getConfig();

    // Migration to version 3.1.0
    const folders = config.get<any>(SETTINGS_CONTENT_FOLDERS);
    if (folders && folders.length > 0) {
      const workspace = Folders.getWorkspaceFolder();
      const projectFolder = basename(workspace?.fsPath || "");

      const paths = folders.map((folder: any) => ({
        title: folder.title,
        path: `${WORKSPACE_PLACEHOLDER}${folder.fsPath.split(projectFolder).slice(1).join('')}`.split('\\').join('/')
      }));

      await config.update(`${SETTINGS_CONTENT_PAGE_FOLDERS}`, paths);
    }

    // Migration to version 3.2.0
    const dateField = config.get<string>(SETTING_DATE_FIELD);
    const lastModField = config.get<string>(SETTING_MODIFIED_FIELD);
    const description = config.get<string>(SETTING_SEO_DESCRIPTION_FIELD);
    const contentTypes = config.get<ContentType[]>(SETTING_TAXONOMY_CONTENT_TYPES);

    if (contentTypes) {
      let needsUpdate = false;
      let defaultContentType = contentTypes.find(ct => ct.name === DEFAULT_CONTENT_TYPE_NAME);

      if (defaultContentType) {
        if (dateField && dateField !== "date") {
          defaultContentType.fields = defaultContentType.fields.filter(f => f.name !== "date");
          defaultContentType.fields.push({
            name: dateField,
            type: "datetime"
          });
          needsUpdate = true;
        }
  
        if (lastModField && lastModField !== "lastmod") {
          defaultContentType.fields = defaultContentType.fields.filter(f => f.name !== "lastmod");
          defaultContentType.fields.push({
            name: lastModField,
            type: "datetime"
          });
          needsUpdate = true;
        }
  
        if (description && description !== "description") {
          defaultContentType.fields = defaultContentType.fields.filter(f => f.name !== "lastmod");
          defaultContentType.fields.push({
            name: description,
            type: "string"
          });
          needsUpdate = true;
        }
  
        if (needsUpdate) {
          await config.update(SETTING_TAXONOMY_CONTENT_TYPES, contentTypes);
        }
      }
    }
  }

  public async setState(propKey: string, propValue: string): Promise<void> {
    await this.ctx.globalState.update(propKey, propValue);
  }

  public async getState<T>(propKey: string): Promise<T | undefined> {
    return await this.ctx.globalState.get(propKey);
  }

  public isBetaVersion() {
    return basename(this.ctx.globalStorageUri.fsPath) === EXTENSION_BETA_ID;
  }

  public checkIfExtensionCanRun() {
    if (this.isBetaVersion()) {
      const mainVersionInstalled = extensions.getExtension(EXTENSION_ID);

      if (mainVersionInstalled) {
        Notifications.error(`Front Matter BETA cannot be used while the main version is installed. Please ensure that you have only over version installed.`);
        return false;
      }
    }

    return true;
  }
}