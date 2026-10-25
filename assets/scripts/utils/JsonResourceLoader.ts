import { JsonAsset, resources } from 'cc';

export interface JsonAssetLoader {
    load<T>(resourcePath: string): Promise<T>;
}

export class CocosJsonResourceLoader implements JsonAssetLoader {
    public load<T>(resourcePath: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            resources.load(resourcePath, JsonAsset, (error, asset) => {
                if (error !== null) {
                    reject(new Error(`Unable to load JSON resource "${resourcePath}": ${error.message}`));
                    return;
                }

                if (asset.json === null || asset.json === undefined) {
                    reject(new Error(`JSON resource "${resourcePath}" is empty.`));
                    return;
                }

                resolve(asset.json as T);
            });
        });
    }
}
