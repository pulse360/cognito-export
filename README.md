# awscognito

awscognito is a CLI tool, written as node module for the purpose of exporting users from AWS Cognito user pools, in JSON or CSV format, as well as importing users from CSV files into AWS Cognito user pools.

## Installation
```bash
npm install awscognito --global
```

## Usage
```bash
awscognito export-users --user-pool-id <user-pool-id> [--format <json/csv>]
awscognito import-users --user-pool-id <user-pool-id> --file <csv-filename>
```