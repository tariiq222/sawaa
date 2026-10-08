"""Local synthetic transport for native UI tests; never forwards to a provider."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlsplit
import json
import uuid

USER = dict(id='payment-e2e-client', name='مستفيد الاختبار', firstName='مستفيد', lastName='الاختبار', email='qa@example.test', phone=None, gender=None, avatarUrl=None, role='CLIENT', isActive=True, isSuperAdmin=False, permissions=[], pushEnabled=False)
SERVICE = dict(id='qa-service', categoryId='qa-clinic', nameAr='جلسة الاختبار', nameEn='QA session', price=12500, currency='SAR', isHidden=False, isActive=True)
CATEGORY = dict(id='qa-clinic', kind='CLINIC', bookingMode='SERVICES', nameAr='عيادة الاختبار', nameEn='QA clinic', isActive=True)
CATALOG = dict(departments=[], categories=[CATEGORY], services=[SERVICE])
BRANCH = dict(id='qa-branch', nameAr='فرع الاختبار', nameEn='QA branch', isActive=True)
EMPLOYEE = dict(id='qa-employee', nameAr='مستشار الاختبار', nameEn='QA counselor', serviceIds=['qa-service'], isBookable=True)
CAPABILITIES = dict(enabled=True, isLive=False, supportedNetworks=['mada', 'visa', 'mastercard'], applePay=None)
bookings = {}
events = []
payments = {}
purchases = {}
completed_invoices = set()
run_id = uuid.uuid4().hex[:10]

def booking(key, invoice=None, **fields):
    return dict(id=key, invoiceId=invoice, status='AWAITING_PAYMENT', serviceId='qa-service', branchId='qa-branch', employeeId='qa-employee', serviceNameAr='جلسة الاختبار', scheduledAt='2026-10-20T10:00:00.000Z', deliveryType='IN_PERSON', **fields)

def config(key):
    return dict(**CAPABILITIES, publishableKey='pk_test_local_ui_fixture', givenId=key, amount=12500, currency='SAR', description='Local UI fixture — no payment submission')

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def reply(self, value, status=200):
        data=json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        path=urlsplit(self.path).path.removeprefix('/api/v1')
        responses={
            '/__events':events, '/public/services':CATALOG,
            '/public/employees':[EMPLOYEE], '/public/employees/qa-employee':EMPLOYEE,
            '/public/branches':[BRANCH], '/public/branding':{},
            '/public/payments/methods':dict(moyasarEnabled=True, atClinicEnabled=True),
            '/mobile/client/payments/native/config':CAPABILITIES,
            '/mobile/client/payments/bank-transfer/settings':dict(enabled=True, accounts=[dict(id='qa-bank', label='حساب الاختبار', bankName='QA Bank', beneficiaryName='QA Center', iban='SA0000000000000000000000')]),
            '/mobile/client/profile':USER, '/auth/me':USER,
            '/mobile/client/notifications/unread-count':dict(count=0),
            '/mobile/client/packages/purchases':[],
            '/mobile/client/bookings':dict(items=[],meta=dict(total=0,page=1,limit=20,totalPages=0)),
            '/public/package-families':[], '/public/programs':[], '/public/mobile-home-cards':[],
            '/mobile/client/portal/summary':dict(totalBookings=0, totalSessions=0, completedBookings=0, upcomingBookings=0, totalSpent=0, outstandingBalance=0, activePackages=0), '/mobile/client/portal/home':dict(profile=USER, upcomingBookings=[], unreadNotifications=[], recentPayments=[]),
        }
        if path.startswith('/mobile/client/bookings/'):
            key=path.rsplit('/',1)[-1]; self.reply(bookings.get(key,booking(key,key+'-invoice'))); return
        if path.startswith('/public/package-families/'):
            key=path.rsplit('/',1)[-1]
            self.reply(dict(id=key,nameAr='باقة الاختبار',nameEn='QA package',descriptionAr='باقة محلية للاختبار',isStandalone=False,vatRate=0,options=[dict(id=key+'-option',nameAr='خيار الاختبار',sessionCount=3,price=dict(finalPrice=12500),groups=[])])); return
        if path.startswith('/mobile/client/packages/purchases/'):
            self.reply(purchases.get(path.rsplit('/',1)[-1],{})); return
        if path.startswith('/mobile/client/payments/invoices/'):
            invoice=path.rsplit('/',1)[-1]
            self.reply(dict(id=invoice,status='PAID' if invoice in completed_invoices else 'ISSUED',total=12500,currency='SAR',payments=[])); return
        self.reply(responses.get(path, []))
    def do_POST(self):
        global run_id
        path=urlsplit(self.path).path.removeprefix('/api/v1')
        body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
        if path == '/__reset':
            run_id=uuid.uuid4().hex[:10]
            events.clear(); bookings.clear(); completed_invoices.clear(); self.reply({}); return
        if path == '/__complete':
            invoice=body['invoiceId']; completed_invoices.add(invoice)
            for record in bookings.values():
                if record['invoiceId'] == invoice: record['status']='CONFIRMED'
            self.reply({}); return
        events.append(dict(path=path, body=body))
        if path == '/mobile/client/bookings':
            key=f'qa-{run_id}-booking-{len(bookings)+1}'; invoice=None if body.get('payAtClinic') else f'qa-{run_id}-invoice-{len(bookings)+1}'
            result=booking(key,invoice); result['scheduledAt']=body['scheduledAt']
            if body.get('payAtClinic'): result['status']='CONFIRMED'; result['payAtClinic']=True
            bookings[key]=result; self.reply(result); return
        if path == '/mobile/client/payments/native/init':
            key=str(uuid.uuid5(uuid.NAMESPACE_URL,body['invoiceId'])); payments[key]=body['invoiceId']
            self.reply(dict(paymentId=key,invoiceId=body['invoiceId'],config=config(key))); return
        if path == '/mobile/client/payments/package-purchases/native/init':
            invoice=body['packageId']+'-invoice'; purchase_id=body['packageId']+'-purchase'
            key=str(uuid.uuid5(uuid.NAMESPACE_URL,invoice)); payments[key]=invoice
            purchases[purchase_id]=dict(id=purchase_id,invoiceId=invoice,packageId=body['packageId'],packageFamilyId=body['packageFamilyId'],branchId=body['branchId'],status='PENDING',credits=[],packageNameAr='باقة الاختبار',modelVersion='GROUPED_V2')
            self.reply(dict(purchaseId=purchase_id,paymentId=key,invoiceId=invoice,config=config(key))); return
        if path.endswith('/reconcile'):
            key=path.split('/')[-2]; invoice=payments.get(key,'qa-existing-invoice'); complete=invoice in completed_invoices
            self.reply(dict(paymentId=key,invoiceId=invoice,status='COMPLETED' if complete else 'PENDING',requiresReview=False,canCreatePayment=not complete)); return
        self.reply(dict(message='Unexpected local test request'),400)

HTTPServer(('127.0.0.1',59002), Handler).serve_forever()
