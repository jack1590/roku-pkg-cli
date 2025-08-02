import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

export class RokuAPI {
    private baseUrl: string;
    private auth: { username: string; password: string };

    constructor(ip: string, password: string) {
        this.baseUrl = `http://${ip}`;
        this.auth = { username: 'rokudev', password };
    }

    async testConnection(): Promise<boolean> {
        try {
            await axios.get(`${this.baseUrl}:8060/query/device-info`);
            return true;
        } catch (error) {
            return false;
        }
    }

    async rekeyDevice(signKey: string, packagePath: string): Promise<void> {
        if (!fs.existsSync(packagePath)) {
            throw new Error(`Package file not found: ${packagePath}`);
        }

        const formData = new FormData();
        formData.append('mysubmit', 'Rekey');
        formData.append('passwd', signKey);
        formData.append('archive', fs.createReadStream(packagePath));

        try {
            const response = await axios.post(
                `${this.baseUrl}/plugin_install`,
                formData,
                {
                    auth: this.auth,
                    headers: formData.getHeaders(),
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                }
            );

            // Check if rekey was successful
            if (response.data.includes('Failed') || response.data.includes('Error')) {
                throw new Error('Rekey operation failed');
            }
        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new Error('Authentication failed. Check your Roku password.');
            }
            throw error;
        }
    }

    async createPackage(): Promise<Buffer> {
        const formData = new FormData();
        formData.append('mysubmit', 'Package');
        formData.append('app_name', 'RokuPkgCLI');
        formData.append('passwd', ''); // No password needed for packaging
        formData.append('pkg_time', new Date().getTime().toString());

        try {
            const response = await axios.post(
                `${this.baseUrl}/plugin_package`,
                formData,
                {
                    auth: this.auth,
                    headers: formData.getHeaders(),
                    responseType: 'arraybuffer'
                }
            );

            return Buffer.from(response.data);
        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new Error('Authentication failed. Check your Roku password.');
            }
            throw error;
        }
    }
} 