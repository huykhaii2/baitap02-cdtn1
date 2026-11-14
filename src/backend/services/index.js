// Lắp ráp các service với repository thật. Unit test dùng thẳng các hàm create*Service với repository giả.
const db = require('../config/db');
const { getAuthConfig } = require('../config/env');
const ticketRepo = require('../repositories/ticketRepository');
const deviceRepo = require('../repositories/deviceRepository');
const customerRepo = require('../repositories/customerRepository');
const statusLogRepo = require('../repositories/statusLogRepository');
const issueCategoryRepo = require('../repositories/issueCategoryRepository');
const staffRepo = require('../repositories/staffRepository');
const healthRepo = require('../repositories/healthRepository');

const { createStatusService } = require('./statusService');
const { createTicketService } = require('./ticketService');
const { createClassifyService } = require('./classifyService');
const { createAssignService } = require('./assignService');
const { createMasterDataService } = require('./masterDataService');
const { createAuthService } = require('./authService');
const { createHealthService } = require('./healthService');

const statusService = createStatusService({ ticketRepo, statusLogRepo });

module.exports = {
  statusService,
  ticketService: createTicketService({ db, ticketRepo, deviceRepo, customerRepo, statusLogRepo, statusService }),
  classifyService: createClassifyService({ db, ticketRepo, issueCategoryRepo, statusService }),
  assignService: createAssignService({ db, ticketRepo, staffRepo, statusService }),
  masterDataService: createMasterDataService({ db, customerRepo, deviceRepo, ticketRepo }),
  authService: createAuthService({ staffRepo, getAuthConfig }),
  healthService: createHealthService({ healthRepo }),
};
