import { CognitoIdentityServiceProvider } from 'aws-sdk';
import * as meow from 'meow';
import fs = require('fs');

export const NAME = "cli";

const USAGE = `
    Usage
      $ awscognito export-users --user-pool-id <user-pool-id> [--format <JSON/CSV>]
      $ awscognito import-users --user-pool-id <user-pool-id> --file <csv-file>

    AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are specified in ~/.aws/credentials
`;

const methods: Record<string, Function> = {
    "export-users": exportUsersCli,
    "import-users": importUsersCli
};

main().then((code) => process.exit(code));

async function main() {
    console.dir(process.argv);
    const cli: meow.Result = meow(USAGE);
    const method = methods[cli.input[0]];
    if (!method) return (cli.showHelp(), 0);

    try {
        let code = await method(cli);
        return code;
    } catch (err) {
        return -1;
    }
}

/*== WRAPPER FUNCTIONS ==*/

async function exportUsersCli(cli: meow.Result): Promise<number> {
    const userpool = cli.flags.userPoolId;
    const [region] = userpool.split("_");
    const format = cli.flags.format.toLowerCase() || "json";
    if (!userpool) {
        console.error("[ERROR] Missing arguments: --user-pool-id is required!");
        cli.showHelp();
    }
    if (format != "json" && format != "csv") {
        console.error("[ERROR] Invalid export format: only JSON and CSV are supported!");
        cli.showHelp();
    }
    try {
        return exportUsers(userpool, region, format);
    } catch (err) {
        throw err;
    }
}

function importUsersCli(cli: meow.Result) {
    const userpool = cli.flags.userPoolId;
    const [region] = userpool.split("_");
    const file = cli.flags.file;
    if (!userpool || !file) {
        console.error("[ERROR] Missing arguments: --user-pool-id and --file are required!");
        cli.showHelp();
    }
    fs.stat(file, function (err, stats) {
        if (err) {
            console.error("[ERROR] The specified file does not exist!");
            cli.showHelp();
        }
        if (file.split(".").pop() !== "csv") {
            console.error("[ERROR] The specified file is not in CSV format!");
            cli.showHelp();
        }
    });
    return importUsers(userpool, region, file);
}

/*== LOGIC FUNCTIONS ==*/

async function exportUsers(userpool: string, region: string, format: string): Promise<number> {
    const cognito = new CognitoIdentityServiceProvider({ region });
    const params: CognitoIdentityServiceProvider.ListUsersRequest = { UserPoolId: userpool };
    let filename: string = `${userpool}.${format}`
    let result: any[] = [];
    let users: CognitoIdentityServiceProvider.ListUsersResponse;

    do {
        params.PaginationToken = users && users.PaginationToken;
        users = await cognito.listUsers(params).promise();
        result = result.concat(users.Users);
    } while (users.PaginationToken);

    if (format === "json") {
        fs.writeFileSync(filename, JSON.stringify(result));
    } else if (format === "csv") {
        let header = await getHeader(userpool, region);
        let text = csv(result, header);
        fs.writeFileSync(filename, text);
    }

    return 0;
}

function importUsers(userpool: string, region: string, filename: string) {
    // TO DO
}

/*== HELPER FUNCTIONS ==*/

const COMMON_ATTRIBUTES = [
    "cognito:username", "cognito:mfa_enabled", "updated_at"
]

const GENERAL_ATTRIBUTES = [
    "name", "nickname", "given_name", "family_name", "middle_name",
    "preferred_username", "gender", "birthdate", "address",
    "profile", "picture", "website", "zoneinfo", "locale",
    "email", "email_verified", "phone_number", "phone_number_verified"
]

function csv(users: any[], header: string[]) {
    const CUSTOM_ATTRIBUTES = header.filter(attribute => attribute.startsWith("custom:"));
    let result: string = COMMON_ATTRIBUTES.concat(GENERAL_ATTRIBUTES).concat(CUSTOM_ATTRIBUTES).join() + "\r\n";
    for (let user of users) {
        let record: string = `${user.Username},${user.MFAOptions ? true : false},${Date.parse(user.UserLastModifiedDate)}`;
        GENERAL_ATTRIBUTES.forEach(attribute => {
            let att = user.Attributes.find((item: { Name: string; Value: string }) => item.Name === attribute);
            record += ",";
            record += att && att.Value ? att.Value : (attribute == "email_verified" || attribute == "phone_number_verified") ? "false" : "";
        });
        CUSTOM_ATTRIBUTES.forEach(attribute => {
            let att = user.Attributes.find((item: { Name: string; Value: string }) => item.Name === attribute);
            record += ",";
            record += att && att.Value || "";
        });
        result += `${record}\r\n`;
    };
    return result;
}

/*
function escape(value: any) {
    value = value === null || value == undefined ? "" : "" + value;
    value = value.split("\"").join("\"\"");
    return value;
}*/

async function getHeader(userpool: string, region: string) {
    const cognito = new CognitoIdentityServiceProvider({ region });
    let result = await cognito.getCSVHeader({ UserPoolId: userpool }).promise()
    return result.CSVHeader;
}