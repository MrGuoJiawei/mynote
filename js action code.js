// js action code
// 客户服务中心 onCreate

// 关闭导航栏
OC.setMenuCollapse(true);

// 注册事件：更新客户
OC.eventOn('customer.service.center.updateCustomer', updateCustomer);

// 注册事件：更新
OC.eventOn('customer.service.center.update', update);

// 更新
function update() {
  var ocId = ocWindow.getComponentByName('Input10').getValue();
  if (ocId) {
    updateCustomer({ocId: ocId});
  }
}

// 更新客户
function updateCustomer(params) {
  if(!params || !params.ocId) {
    console.error('Can not update customer info without customer ocId');
    return;
  }
  var customerId = params.ocId;
  // 更新客户信息
  updateCustomerInfo(customerId);
  // 更新客户历史订单
  OC.eventEmit('customer.service.center.updateHistoryOrders', customerId);
  // 更新客户待结账订单
  OC.eventEmit('customer.service.center.updateOutstandingOrderList', customerId);
}

// 更新客户信息
function updateCustomerInfo(customerId) {
  var Form1 = ocWindow.getComponentByName('Form1');
  var fieldSet = Form1.getFieldSet();
  OC.getOne(
    "com.open_care.dto.customer.PersonalCustomerDTO",
    customerId,
    fieldSet,
    function(response) {
      if (response && response.status === '0') {
        Form1.setFieldsValue(response.data.data);
        var customerTeamMembers = response.data.data.customerTeamMembers || [];
        ocWindow.getComponentByName('Table1').setDataSource({
          data: customerTeamMembers,
          authority: {}
        });
        var familyMembers = response.data.data.familyMembers || [];
        ocWindow.getComponentByName('Table2').setDataSource({
          data: familyMembers,
          authority: {}
        });
      }
    },
    function() {}
  );
}


// 历史订单页面 onCreate
OC.eventOn('customer.service.center.updateHistoryOrders', updateHistoryOrders);

function updateHistoryOrders(partyRole) {
  if (!partyRole) {
    return;
  }
  
  var filters = [
    {"fieldName" : "partyRole", "fieldValue" : partyRole, "operator":"equal"},
    {"fieldName" : "orderStatus", "fieldValue" : ['1','3'], "operator":"in"}
  ];
  
  OC.clearTableFilterAndQueryTableWithEntityName(
    ocWindow.getComponentByName("Table1"), 
    'com.open_care.dto.order.pay.OrderDTO',
    filters
  );
}

// 挂号信息页面 onCreate
OC.eventOn('customer.service.center.updateRegistrationInfo', updateRegistrationInfo);

function updateRegistrationInfo(customerId) {
  if (!customerId) {
    return;
  }
  
  var filters = [
    {"fieldName" : "customerId", "fieldValue" : customerId, "operator":"equal"}
  ];
  
  OC.clearTableFilterAndQueryTableWithEntityName(
    ocWindow.getComponentByName("Table1"), 
    'com.open_care.dto.registration.RegistrationInfoDTO"',
    filters
  );
}


// 挂号磁贴模板脚本
var titleStr = payload.departmentName;
if (payload.resourceName) {
  titleStr += (' - '+ payload.resourceName);
}
var styleStr = '';
var canAppointment = true;
var statusStr = payload.remainQuantity + '/' + payload.capacity;
if (payload.capacity !== null && payload.remainQuantity <= 0) {
  canAppointment = false;
  styleStr = ' style = "background-color: red;"';
}

var productStr = '<ul>';
var products = payload.registrationProducts || [];

if (!window.customFunForRegistration) {
  window.customFunForRegistration = {}
}

for (var index = 0; index < products.length; index++) {
  var element = products[index];
  var funName = element.productId;
  window.customFunForRegistration[funName] = function(productId) {
    if (payload.capacity !== null && payload.remainQuantity <= 0) {
      OC.showNotificationDlg('错误', '已约满，请重新选择', 'error');
      return;
    }
    var productInfo = products.find(function(item) { return item.productId === productId});
    payload.productInfo = productInfo;
    OC.showModalDialog('Layout_registration_type', payload);
  }
  var liStyle = '';
  if (products.length === 1) {
    liStyle = 'style = "line-height: 20px;"'
  }
  var handleStr = 'window.customFunForRegistration["'+funName+'"]("'+element.productId+'")';
  productStr += '<li title="双击挂号" '+liStyle+' ondblclick='+handleStr+'>'+element['productName']+'</li>';
}
productStr += '</ul>';

return '<div class="ant-card ant-card-bordered"><div class="ant-card-head" '+styleStr+'><div class="ant-card-head-wrapper"><div class="ant-card-head-title">'+titleStr +'</div><div class="ant-card-extra">'+statusStr+'</div></div></div><div class="ant-card-body"><div class="shiftBox">'+payload.shiftName+'</div><div class="productList">'+productStr+'</div></div></div>';


// 挂号 onCreate
// 初始化 当日号别
updateRegistrationForDate();
// 初始化 本周号别
updateRegistrationForWeek({
  dateStr: OC.getMoment().format('YYYY-MM-DD')
});

// 注册
OC.eventOn('customer.registration.updateRegistrationForDate', updateRegistrationForDate);
OC.eventOn('customer.registration.updateRegistrationForWeek', updateRegistrationForWeek);

// 更新 日 号数据
function updateRegistrationForDate() {
  updateRegistration({
    dateStr: OC.getMoment().format('YYYY-MM-DD'),
    departmentId: ocWindow.getComponentByName('Select1').getValue(),
    resourceId: ocWindow.getComponentByName('Select2').getValue(),
    callbackFun: handleResponseForList
  });
}

// 更新 周 号数据
function updateRegistrationForWeek(params) {
  if (!params.dateStr) {
    return;
  }
  var Calendar1 = ocWindow.getComponentByName('Calendar1');
  Calendar1.getToolbar().onNavigate('prev', new Date(params.dateStr));
  params.departmentId = ocWindow.getComponentByName('Select3').getValue();
  params.resourceId = ocWindow.getComponentByName('Select4').getValue();
  params.callbackFun = handleResponseForWeek;
  params.viewType = 'week';
  updateRegistration(params);
}

// 当日号别 回调
function handleResponseForList(response) {
  if (response && response.status === '0') {
    response.data.data = response.data.data.map(function(item) {
      if (item.capacity  !== null) {
        var capacity = item.capacity || 0;
        var products = item.registrationProducts || [];
        var usedTimes = 0;
        products.forEach(function(pItem) {
          usedTimes += (pItem.usedTimes || 0);
        });
        item.remainQuantity = capacity - usedTimes;
      }
      return item;
    });
	  ocWindow.getComponentByName('List1').setDataSource(response.data);
	}
}

// 周号别 回调
function handleResponseForWeek(response) {
	if (response && response.status === '0') {
		var data = response.data.data || [];
		var newData = data.map(function(item) {
			var scheduleDateStr = OC.getMoment(new Date(item.scheduleDate)).format('YYYY-MM-DD');
			var scheduleDateStartTime = scheduleDateStr + ' ' + item.shiftStartTime;
			var scheduleDateEndTime = scheduleDateStr + ' ' + item.shiftEndTime;
      item.color = '#02B980';
			item.oldShiftName = item.shiftName;
			item.shiftStartTime = scheduleDateStartTime;
			item.shiftEndTime = scheduleDateEndTime;
      item.id = scheduleDateStr+'_'+item.departmentId+'_'+item.resourceId+'_'+item.shiftId;
      item.shiftName = item.departmentName;
      if (item.resourceName) {
        item.shiftName += (' - ' + item.resourceName)
      }
      if (item.capacity  !== null) {
        var capacity = item.capacity || 0;
        var products = item.registrationProducts || [];
        var usedTimes = 0;
        products.forEach(function(pItem) {
          usedTimes += (pItem.usedTimes || 0);
        });
        item.remainQuantity = capacity - usedTimes;
        if (item.remainQuantity <= 0) {
          item.color = 'red';
          item.shiftName += '<br />(已约满)';
        }
      }
			return item;
		});
		ocWindow.getComponentByName('Calendar1').setDataSource({data: newData});
	}
}

// 获取数据
function updateRegistration(params) {
  var pagination = {
    "pageSize": 5000,
    "current": 1
  };
  var dateStr = params.dateStr;
  var viewType = params.viewType;
  var dateMoment = OC.getMoment(new Date(dateStr));
  var startDate = dateStr;
  var endDate = dateStr;
  if (viewType === 'week') {
    startDate = dateMoment.startOf('week').format('YYYY-MM-DD');
    endDate = dateMoment.endOf('week').format('YYYY-MM-DD');
    var nowDateStr = OC.getMoment().format('YYYY-MM-DD');
    if (OC.getMoment(nowDateStr) > OC.getMoment(endDate)) {
      return;
    }
    if (OC.getMoment(nowDateStr) > OC.getMoment(startDate)) {
      startDate = nowDateStr;
    }
  }

  var filters = [
    {
      "fieldName": "fromDate",
      "fieldValue": startDate,
      "operator": "equal"
    },
    {
        "fieldName": "endDate",
        "fieldValue": endDate,
        "operator": "equal"
    }
  ];
  
  
  if (params.departmentId) {
  	filters.push(
  		{
  			"fieldName": "departmentId",
  			"fieldValue": departmentId,
  			"operator": "equal"
  		}
  	);
  }
  
  
  if (params.resourceId) {
  	filters.push(
  		{
  			"fieldName": "resourceId",
  			"fieldValue": resourceId,
  			"operator": "equal"
  		}
  	);
  }

  var body = {
    "entityName": "com.open_care.dto.registration.AvailableRegistrationUnitDTO",
    "filters": filters,
    "summary": {},
    "fieldSet":"",
    "pagination": pagination
  }

  var callbackFun = params.callbackFun || function(response) {}

  OC.restPostApiCall(
    '/query', 
    {},
    body,
    callbackFun,
    function(){}
  );
}

// 执行挂号
var ctxs = ocWindow.getContexts();

var products = payload.registrationProducts || [];
if (!products.length) {
  return;
}

if (products.length > 1) {
  payload.callbackFun = handleReg;
  OC.showModalDialog('Layout_registration_type', payload);
  return;
}

if (products.length === 1) {
  handleReg(products[0]);
}

// 执行挂号
function handleReg(params) {
  if (!params.productId) {
    return;
  }
  var body = {
    "customerId": ctxs.customerId,
    "serviceCustomerId": ctxs.customerId,
    "departmentId": payload.departmentId,
    "scheduleDate": OC.getMoment(new Date(payload.scheduleDate)).format('YYYY-MM-DD'),
    "shiftId": payload.shiftId,
    "productId": params.productId
  }
  if (payload.resourceId) {
    body.resourceId = payload.resourceId;
  }

  OC.restPostApiCall(
    '/registration/doSimpleRegistration', 
    {},
    body,
    responseHandler, 
    function(){}
  );
}

// 挂号回调
function responseHandler(response) {
  if (response && response.status === '0') {
    // 更新挂号单列表
    OC.eventEmit('customer.service.center.updateRegistrationInfo', ctxs.customerId);
    // 更新客户待结账订单
    OC.eventEmit('customer.service.center.updateOutstandingOrderList', customerId);
    // 打开付款弹框
    var body = {};
    body.order_ocId = response.data.customerRegisterId;
    body.appointmentId = response.data.appointmentId;
    OC.showModalDialog('OrderPayment', body, null,  '80%');
  }
}


// 挂号弹框 挂号信息
var ctsx = ocWindow.getContexts();
var titleStr = ctxs.departmentName;
if (ctxs.resourceName) {
  titleStr += (' - ' + ctxs.resourceName);
}
titleStr += (' - ' + ctxs.shiftName);
titleStr += (' - ' + ctxs.scheduleDate);
self.setValue(titleStr);


// 客户服务中心 Tabs 组件 onCreate
OC.eventOn('customer.service.center.updateRegistrationTabTitleCount', updateCountNumber);
OC.eventOn('customer.service.center.updateRegistrationTabTitleCountByCustomerId', updateCountNumberByCustomerId);

function updateCountNumberByCustomerId (customerId) {
  if (!customerId) {
    return;
  }
  OC.restGetApiCall(
    '/registration/getRegistrationNumberWhenNotServicedAndNotExpire/{customerId}', 
    {customerId: customerId},
    function(re){
      console.log('re: ', re);
      if (re && re.status === '0') {
        updateCountNumber(re.data || '0');
      }
    }
  );
}

function updateCountNumber(countNumber) {
  self.setPanelTitle("02", "挂号信息("+countNumber+')');
}

// 取消挂号
OC.restGetApiCall(
  '/registration/getRegistrationNumberWhenNotServicedAndNotExpire/{appointmentId}', 
  {appointmentId: payload.appointmentId},
  function(re){
    console.log('re: ', re);
    if (re && re.status === '0') {
      self.update()
    }
  }
);


// 预约信息 onCreate
OC.eventOn('customer.service.center.updateAppointmentInfo', updateAppointmentInfo);

function updateAppointmentInfo(customerId) {
  if (!customerId) {
    return;
  }
  var filters = [
    {
      "fieldName": "customerId",
      "fieldValue": customerId,
      "operator": "equal"
    }
  ];
  var tableIns = ocWindow.getComponentByName('Table1');
  function converter(response) {
    return response;
  }
  OC.queryTable(tableIns, filters, converter, function(response){
    if (response && response.status == '0') {
      self.setDataSource(response.data);
    }
  },function(){});
}


// 预约信息编辑按钮 onClick
var topWin = OC.getCurrentTopWindow();

var body = {};
body.customerId = topWin.getComponentByName('Input10').getValue(); 
body.customerName = topWin.getComponentByName('Input2').getValue();
body.customerNo = topWin.getComponentByName('Input5').getValue();
body.customerLevel = topWin.getComponentByName('Select2').getValue();


OC.showModalDialog("LayoutAppointmentInfo",{"data":body}, null, 1200);

// 预约信息详情页面 onCreate
var windowContext = ocWindow.getContexts(); 
console.log('预约详情',windowContext);
if(windowContext.data) {
  if (windowContext.record && windowContext.record.appointmentId) {
    // 编辑预约信息
    var Form1 = ocWindow.getComponentByName('Form1');
    var fieldSet = Form1.getFieldSet();
    OC.getOne(
      "com.open_care.dto.appointment.ProductAppointmentInfoDTO",
      windowContext.record.appointmentId,
      fieldSet,
      function(response) {
        OC.setFormValues(ocWindow, 'Form1', response.data);
      },
      function() {}
    );
    return;
  }
  // 新建预约信息
  var data = {data: windowContext.data,"authorityData":{}}
	OC.setFormValues(ocWindow, 'Form1', data);
}

// 保存报价单
var ctxs = ocWindow.getContexts();
if (!ctxs || !ctxs.customerId) {
  OC.showNotificationDlg('错误', "客户信息有误！", 'error');
  ocWindow.goBack();
}
var Form1 = ocWindow.getComponentByName('Form1'); 
var values = Form1.getFieldsValue();
values.customerId = ctxs.customerId;
var entityName = Form1.getEntityName();
function handleSave(response) {
  console.log('save res: ', response);
}
OC.save(entityName, values, handleSave, function() {});


// 
var currentValue = payload.value;

if (!currentValue) {
  return;
}

function getResponseHandler(response) {
  if (response && response.status === '0') {
    var data = response.data.data || [];
    var options = data.map(function(item) {
      return {
        label: item.productName,
        value: item.ocId
      }
    });
    self.setOptions(options);
  }
}

var filters = [
  {
    fieldName: "productName",
    fieldValue: currentValue,
    operator: "like"
  }
];

OC.restPostApiCall(
  '/query', 
  {},
  {
    "entityName": "com.open_care.product.entity.OCProduct",
    "filters": filters,
    "pagination": {
        "pageSize": 50,
        "current": 1
    }
  },
  getResponseHandler, 
  function(){}
);




console.log("payload:",payload);
var uriVariables = {};
uriVariables.servicePlanAssocId = payload.PartyRole;
OC.restGetApiCall('/api/disableServicePlan/{servicePlanAssocId}',uriVariables,function(response){
  if(response.status==='0'){
    var customerOcId = ocWindow.getComponentByName('Form2_Input0').getValue();
    if(customerOcId){
      var uriVariables = {};
      uriVariables.partyRoleId = customerOcId;
      OC.restGetApiCall(
        '/api/getServiceItemsDetailInfoByPartyRole/{partyRoleId}',
        uriVariables,
        responseHeadler
      );
    }
  }
})
function responseHeadler(response){
  if(response.status==='0'){
    /*查询企业客户关联的服务方案*/
    var customerOcId = ocWindow.getComponentByName('Form2_Input0').getValue();
    if(customerOcId){
      var filters = [{"fieldName" : "partyRole","fieldValue" : customerOcId ,"operator" : "equal"}];
      var summary = {};
      var pagination = {};
      pagination.pageSize = 5;
      pagination.current = 1;
      var fieldSet = "";
    } 
    OC.clearTableFilterAndQueryTableWithEntityName(
      ocWindow.getComponentByName("Table3"), 
      'com.open_care.dto.policy.PartyRoleAndServicePlanBindDTO',
      filters, converter
    );
  }
}

function converter(response) {
  var {data} = response;
  var newData = data.map(function(r){
      var newServicePlanData = {};
      newServicePlanData = {
       'planName' : r.servicePlanName,
       'planStatus' : r.servicePlan.planStatus,
       'thruDate' : r.servicePlan.thruDate,
       'fromDate' : r.servicePlan.fromDate,
       'ocId' : r.servicePlan.ocId,
       'PartyRole' : r.ocId,
       'status' : r.status,
      } 
      return newServicePlanData;
  });
  response.data = newData;
  console.log(response);
  return response;
}

/*执行回调函数给方案Table赋值*/
function servicePlanResponseHandler(response){
  if(response.status === '0'){
 var newData = response.data.data;
 var allValue = {
   data: [],
   authority: []
 };
 var servicePlanData = {};
 var newServicePlanData = {};
 for (i = 0; i < newData.length; i++) { 
    servicePlanData = newData[i];
    newServicePlanData = {
    'planName' : servicePlanData.servicePlanName,
    'planStatus' : servicePlanData.servicePlan.planStatus,
    'thruDate' : servicePlanData.servicePlan.thruDate,
    'fromDate' : servicePlanData.servicePlan.fromDate,
    'ocId' : servicePlanData.servicePlan.ocId,
    'PartyRole' : servicePlanData.ocId,
    'status' : servicePlanData.status,
   } 

    allValue.data.push(newServicePlanData);
 }
 ocWindow.getComponentByName("Table3").setDataSource(allValue);
  }
}



// 注册
OC.eventOn('customer.medical.department.customerOtherDepartmentResults.queryCustomerOtherDepartmentResults', queryCustomerOtherDepartmentResults)

function queryCustomerOtherDepartmentResults(data) {
	console.log('queryCustomerOtherDepartmentResults data', data);
	if (!data.serviceCode) {
		console.error('customer.medical.department.customerOtherDepartmentResults.queryCustomerOtherDepartmentResults return, because serviceCode is empty');
		OC.showNotificationDlg('警告', '请先录入客户信息！', 'warning');
		return;
	}
	var activeKey = OC.getCurrentTopWindow().getComponentByName('Tabs2').getActiveKey();
// 	console.log('customer.medical.department.customerOtherDepartmentResults.queryCustomerOtherDepartmentResults activeKey', activeKey);
	if ('otherDepartmentResults' === activeKey && !data.departmentOcId) {
		OC.showNotificationDlg('警告', '查询出错，当前科室OcId不能为空！', 'warning');
		return;
	}
	var departmentRoleOcId = data.departmentOcId || 'department';
	var url = '/department/getCustomerOtherDepartmentsMedicalData/{serviceCode}/{departmentRoleOcId}';
	var uriVariables = {
		"serviceCode": serviceCode,
		"departmentRoleOcId": departmentRoleOcId
	};
	console.log('uriVariables: ', uriVariables);
	OC.restGetApiCall(url, uriVariables, responseHandler);
}

function responseHandler(response) {
  console.log('response: ', response);
	if ('0' === response.status) {
		ocWindow.getComponentByName('Table1').setDataSource(response.data)
	}
}





// 

OC.queryWithFilters(
  "com.open_care.dto.customer.EnterpriseCustomerDTO",
  [],
  handleFilterResponse,
  function() {}
);

function handleFilterResponse(response) {
  if (response.status !== '0') {
    return;
  }
  var data = response.data.data || [];
  var orgIds = data.filter(function(fItem){
    return (fItem.organization && fItem.organization.ocId);
  }).map(function(oItem) {
    return oItem.organization.ocId;
  });
  
}



// 保存企业客户
var Form1 = ocWindow.getComponentByName('Form1'); 
var values = Form1.getFieldsValue();
var entityName = Form1.getEntityName();
values['organization#businessAddress'] = values.businessAddress;
values['organization#registrationAddress'] = values.registrationAddress;
delete values.businessAddress;
delete values.registrationAddress;
function handleSave(response) {
  console.log('save res: ', response);
}
console.log('values: ', values);

OC.save(entityName, values, handleSave, function() {});

















// 注册
OC.eventOn('open.care.common.chose.company.organization.handleChoseCompanyOrganization', handleChoseCompanyOrganization);
// 更新数据
function handleChoseCompanyOrganization(params) {
  console.log('params: ', params);
  var orgInfo = params.orgInfo;
  if (!orgInfo) {
    return;
  }
  ocWindow.getComponentByName('Form1').setFieldsValue({
    'organization#ocId': orgInfo.ocId
  });
  updateOrganization(orgInfo.ocId);
  
}

function updateOrganization(orgId) {
  if(!orgId){
    return;
  }
  OC.getOne('com.open_care.dto.customer.OrganizationDTO',orgId, '',getOrgResponseHandler);
}

function getOrgResponseHandler(response){
    if (response.status !== '0') {
      return;
    }
    var data = response.data.data;
    if (data.businessAddress) {
      data.businessAddress._entityName = data.businessAddress.entityName;
    }
    if (data.registrationAddress) {
      data.registrationAddress._entityName = data.registrationAddress.entityName;
    }
    var newData = {
      "customerName": data.name,
      "ownUser": data.ownUser,
      "organization#industry": data.industry,
      "organization#employeeNumber": data.employeeNumber,
      "businessAddress": data.businessAddress,
      "registrationAddress": data.registrationAddress,
    };
    ocWindow.getComponentByName('Form1').setFieldsValue(newData);
  }

OC.queryWithFilters(
  "com.open_care.dto.customer.EnterpriseCustomerDTO",
  [],
  handleFilterResponse,
  function() {}
);

function handleFilterResponse(response) {
  if (response.status !== '0') {
    return;
  }
  var data = response.data.data || [];
  var orgIds = data.filter(function(fItem){
    return (fItem.organization && fItem.organization.ocId);
  }).map(function(oItem) {
    return oItem.organization.ocId;
  });
  OC.showModalDialog('Layout_common_chose_company_organization', {usedOrgIds: orgIds},  null,  '80%', '选择公司/组织');
}

// OC.showModalDialog('Layout_common_chose_company_organization', {},  null,  '60%', '选择公司/组织');












var selectedRows = ocWindow.getComponentByName('Table1').getSelectedRows();
if (selectedRows.length === 0) {
  OC.showNotificationDlg('错误', '请选择公司/组织！', 'error');
  return;
}
OC.eventEmit('open.care.common.chose.company.organization.handleChoseCompanyOrganization', {
  orgInfo: selectedRows[0]
});
ocWindow.goBack();