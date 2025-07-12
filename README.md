# Job Dashboard

Repository is divded into 3 parts, which essentialy serve as 3 separate apps:
1. Database - sqlite initialization, api server for managing db data
2. Crawler - webcrawler for getting data, processing it with ai, passing it to database api
3. Dashboard - frontend app for viewing, updating data


Database / database server setup:
1. Create a copy of .env.example file, rename it to .env, setup your API key
2. Make sure you are in the root of the project
3. Run cd database
4. Run npm install
5. Run node server.js
6. Database will be created automatically by server if it doesn't exist

You can run init.js script separately to create database, you can also pass --reset flag to it to reset the database.


Crawler setup:
1. Create a copy of .env.example file, rename it to .env, setup your browser path (prefer to use your day to day real browser)
2. Set websites to false that you dont want to crawl in crawler\config\websites.json
3. Look over specific website urls to crawl in crawler\config\urls.json

## License

This project is dual-licensed:

- **Non-commercial use**: Licensed under CC BY-NC-SA 4.0 (Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International)
- **Commercial use**: Contact tarabara.maksym@protonmail.com for commercial licensing

**You are free to use this software for non-commercial purposes.** For commercial use, modification, or distribution, please contact us for licensing terms.

See the [LICENSE](LICENSE) file for complete details.