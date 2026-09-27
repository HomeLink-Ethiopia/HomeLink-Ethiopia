'use client'

/**
 * Global auto-translate layer.
 *
 * The LanguageProvider + `t.*` translations only cover pages that were
 * written against the translation files. The remaining ~110 pages/components
 * render hardcoded English. This component closes that gap app-wide:
 *
 * - When the active locale is AM, it walks the DOM and swaps any text node
 *   whose trimmed content exactly matches a dictionary entry.
 * - A MutationObserver keeps dynamically rendered content translated too.
 * - Toggle buttons set `homelink-language` in localStorage (same key as the
 *   LanguageProvider), then call `rerender()` — every page re-renders from
 *   the DOM pass without needing to be rewritten.
 *
 * Exact-match only + word boundaries for placeholders keeps things safe:
 * the dictionary is curated UI vocabulary, not free machine translation.
 */

import { useEffect } from 'react'
import { useLanguage } from '@/lib/language-context'

/** English → Amharic dictionary for the hardcoded UI across the app. */
export const UI_DICTIONARY: Record<string, string> = {
  // ─── Generic actions ───
  'Cancel': 'ሰርዝ',
  'Save': 'አስቀምጥ',
  'Submit': 'አስገባ',
  'Send': 'ላክ',
  'Close': 'ዝጋ',
  'Back': 'ተመለስ',
  'Edit': 'አርትዕ',
  'Delete': 'ሰርዝ',
  'Remove': 'አስወግድ',
  'Accept': 'ተቀበል',
  'Decline': 'አትቀበል',
  'Reject': 'እምቢ በል',
  'Approve': 'አጽድቅ',
  'Confirm': 'አረጋግጥ',
  'Apply Now': 'አሁን አመልክት',
  'Apply': 'አመልክት',
  'Withdraw': 'ወጥተህ ልከፈል',
  'Review': 'ግምገማ',
  'Details': 'ዝርዝሮች',
  'View Details': 'ዝርዝር ይመልከቱ',
  'View all': 'ሁሉንም ይመልከቱ',
  'View all →': 'ሁሉንም ይመልከቱ →',
  'Save search': 'ፍለጋ አስቀምጥ',
  'More Filters': 'ተጨማሪ ማጣሪያዎች',
  'Search': 'ፈልግ',
  'Log in': 'ግባ',
  'Login': 'ግባ',
  'Sign up': 'ተመዝገብ',
  'Create an account': 'መለያ ይፍጠሩ',
  'Back to Login': 'ወደ መግቢያ ተመለስ',
  'Log Out': 'ውጣ',
  'Logout': 'ውጣ',
  'Help': 'እገዛ',
  'Privacy': 'ግላዊነት',
  'Terms': 'ውሎች',
  'Settings': 'ቅንብሮች',
  'Profile': 'መገለጫ',
  'Notifications': 'ማሳወቂያዎች',
  'Messages': 'መልእክቶች',
  'Dashboard': 'ዳሽቦርድ',

  // ─── Roles & entities ───
  'Tenant': 'ተከራይ',
  'Landlord': 'ባለቤት',
  'Admin': 'አስተዳዳሪ',
  'Property': 'ንብረት',
  'Properties': 'ንብረቶች',
  'Applications': 'ማመልከቻዎች',
  'Application': 'ማመልከቻ',
  'Agreements': 'ስምምነቶች',
  'Agreement': 'ስምምነት',
  'Payments': 'ክፍያዎች',
  'Payment': 'ክፍያ',
  'Disputes': 'ክርክሮች',
  'Dispute': 'ክርክር',
  'Favorites': 'ተወዳጆች',
  'Favourites': 'ተወዳጆች',
  'Viewings': 'የመመልከቻ ቀጠሮዎች',
  'Viewing': 'የመመልከቻ ቀጠሮ',
  'Maintenance': 'ጥገና',
  'Reviews': 'ግምገማዎች',
  'Verification': 'ማረጋገጫ',
  'Verification Queue': 'የማረጋገጫ ሰልፍ',
  'Users': 'ተጠቃሚዎች',
  'Reports': 'ሪፖርቶች',
  'Analytics': 'ትንተና',
  'Market Insights': 'የገበያ ግንዛቤት',
  'Platform Analytics': 'የመድረክ ትንተና',
  'Audit Logs': 'የኦዲት መዝገቦች',
  'Fraud Reports': 'የማታለል ሪፖርቶች',
  'Risk Monitoring': 'የስጋት ክትትል',
  'My Properties': 'የእኔ ንብረቶች',
  'Add New Property': 'አዲስ ንብረት ጨምር',
  'List Your Property': 'ንብረትዎን ይዝርዝሩ',
  'Edit Property': 'ንብረት አርትዕ',
  'Property Details': 'የንብረት ዝርዝሮች',
  'Message Landlord': 'ባለቤቱን መልእክት ላክ',
  'Quick Actions': 'ፈጣን ተግባራት',

  // ─── Property fields ───
  'Bedrooms': 'መኝታ ክፍሎች',
  'Bathrooms': 'መታጠቢያዎች',
  'Amenities': 'አገልግሎቶች',
  'Description': 'መግለጫ',
  'Location': 'አካባቢ',
  'Status': 'ሁኔታ',
  'Amount': 'መጠን',
  'Priority': 'ቅድሚያ',
  'Size (m²)': 'መጠን (ሜ²)',
  'Property Type': 'የንብረት ዓይነት',
  'Property Type *': 'የንብረት ዓይነት *',
  'Apartment': 'አፓርትመንት',
  'House': 'ቤት',
  'Villa': 'ቪላ',
  'Studio': 'ስቱዲዮ',
  'Furnished': 'የተሸጎጠ',
  'Available': 'ያለበት',
  'Available From': 'ከዚህ ቀን ጀምሮ ያለበት',
  'Street Address': 'የመንገድ አድራሻ',
  'Neighborhood': 'አካባቢ',
  'City': 'ከተማ',
  'Email Address': 'የኢሜይል አድራሻ',
  'Email': 'ኢሜይል',
  'Phone': 'ስልክ',
  'Password': 'የይለፍ ቃል',
  'Re-enter password': 'የይለፍ ቃል እንደገና ያስገቡ',
  'Deposit': 'ጥምዝ',
  'Deposit (ETB)': 'ጥምዝ (ብር)',
  'Security Deposit': 'የደህንነት ጥምዝ',
  'Due Date': 'የመክፈያ ቀን',
  'Reason *': 'ምክንያት *',
  'Total': 'ጠቅላላ',
  'Pricing': 'ዋጋ',
  'Basic Information': 'መሠረታዊ መረጃ',
  'About this home': 'ስለዚህ ቤት',
  'Property Photos': 'የንብረት ፎቶዎች',

  // ─── Statuses ───
  'Verified': 'የተረጋገጠ',
  'Pending': 'በመጠባበቅ ላይ',
  'Approved': 'ጸድቋል',
  'Rejected': 'ውድቅ ተደርጓል',
  'Paid': 'ተከፍሏል',
  'Unpaid': 'አልተከፈለም',
  'Overdue': 'መዘግየቱ በላይ',
  'Active': 'ንቁ',
  'Reserved': 'ተይዟል',
  'Rented': 'ተከራይቷል',
  'Signed': 'ተፈርሟል',
  'Awaiting signature': 'ፊርማ በመጠበቅ ላይ',
  'Confirmed': 'ተረጋግጧል',
  'Cancelled': 'ተሰርዟል',
  'Completed': 'ተጠናቋል',
  'Open': 'ክፍት',
  'Resolved': 'ተፈትቷል',
  'Low': 'ዝቅተኛ',
  'Medium': 'መካከለኛ',
  'High': 'ከፍተኛ',
  'Low priority': 'ዝቅተኛ ቅድሚያ',
  'High priority': 'ከፍተኛ ቅድሚያ',
  'Open in new tab': 'በአዲስ ትር ክፈት',

  // ─── Empty states ───
  'No disputes': 'ክርክሮች የሉም',
  'No agreements yet': 'ገና ስምምነቶች የሉም',
  'No reviews yet': 'ገና ግምገማዎች የሉም',
  'No maintenance requests': 'የጥገና ጥያቄዎች የሉም',
  'No conversations yet.': 'ገና ውይይቶች የሉም።',
  'Type a message...': 'መልእክት ይጻፉ...',
  'Select a conversation to start messaging.': 'መልእክት ለመላክ ውይይት ይምረጡ።',
  'What happened? *': 'ምን ተከስቷል? *',
  'Note to landlord (optional)': 'ለባለቤቱ ማስታወሻ (አማራጭ)',
  'Add a message to the mediator…': 'ለመላኪያ መልእክት ይጨምሩ…',
  'New dispute': 'አዲስ ክርክር',
  'Loading map…': 'ካርታ በመጫን ላይ…',
  'Check Your Email': 'ኢሜይልዎን ይፈትሹ',
  'Why this match?': 'ለምን ይህ ተስማሚ ነው?',
  'Your trusted housing partner in Ethiopia.': 'በኢትዮጵያ ውስጥ የታመነ የቤት አጋርዎ።',
  '← Back to Properties': '← ወደ ንብረቶች ተመለስ',
  'Back to My Properties': 'ወደ የእኔ ንብረቶች ተመለስ',
  'Confirm for:': 'ለቀኑ አረጋግጥ:',
  'Confirmed for:': 'ለቀኑ ተረጋግጧል:',
  'Admin decision': 'የአስተዳዳሪ ውሳኔ',
  'MAIN': 'ዋና',
  'What': 'ምን',
  'Rejected — reason:': 'ውድቅ — ምክንያት:',
  'PDF': 'PDF',
  'Total properties': 'ጠቅላላ ንብረቶች',
  '/mo': '/ወር',
  '/ month': '/ ወር',
  'Addis Ababa': 'አዲስ አበባ',

  // ─── Explore / filters ───
  'All Cities': 'ሁሉንም ከተሞች',
  'Any Type': 'ማናቸውም ዓይነት',
  'Any Price': 'ማናቸውም ዋጋ',
  'Any': 'ማናቸውም',
  'List': 'ዝርዝር',
  'Split': 'ክፍፍል',
  'Map': 'ካርታ',
  'AI Match': 'AI ተስማሚ',
  'AI-Matched for You': 'ለእርስዎ በAI የተመረጡ',
  'AI Recommendations': 'የAI ምክሮች',
  'Save Search': 'ፍለጋ አስቀምጥ',
  'Alerts': 'ማንቂያዎች',
  'Best Match': 'ምርጥ ተስማሚ',
  'Price: Low to High': 'ዋጋ- ከውሑድ እስከ ብዙ',
  'Price: High to Low': 'ዋጋ- ከብዙ እስከ ውሑድ',
  'Newest First': 'አዳዲስ መጀመሪያ',
  'verified homes': 'የተረጋገጡ ቤቶች',
  'found · Showing': 'ተገኝተዋል · እያሳየ',
  'Beds': 'መኝታ',
  'Bath': 'መታጠቢያ',
  'Zoom in': 'አቅራቢ',
  'Zoom out': 'ርቀት',

  // ─── Footer ───
  'About Us': 'ስለ እኛ',
  'Careers': 'ሥራ መደቦች',
  'Blog': 'ብሎግ',
  'Press': 'ፕሬስ',
  'Help Center': 'የእገዛ ማዕከል',
  'Safety Tips': 'የደህንነት ምክሮች',
  'Guides': 'መመሪያዎች',
  'Contact Us': 'ያግኙን',
  'Terms of Service': 'የአገልግሎት ውሎች',
  'Privacy Policy': 'የግላዊነት መመሪያ',
  'Cookie Policy': 'የኩኪ መመሪያ',
  'How we use AI': 'AIን እንዴት እንጠቀማለን',
  'All rights reserved.': 'ሁሉም መብቶች የተጠበቁ ናቸው።',
  'Sitemap': 'የድር ገጽ',
  'Accessibility': 'ተደራሽነት',
  'COMPANY': 'ኩባንያ',
  'RESOURCES': 'መረጃዎች',
  'LEGAL': 'ሕጋዊ',
  'A trusted digital housing platform connecting tenants, landlords, and communities across Ethiopia.': 'ተከራዮችን፣ ባለቤቶችን እና ማህበረሰቦችን በኢትዮጵያ ውስጥ የሚያገናኝ የታመነ የቤት ኪራይ መድረክ።',
  'Menu': 'ምናሌ',
  'Close menu': 'ምናሌ ዝጋ',
  'Open menu': 'ምናሌ ክፈት',
  'Toggle menu': 'ምናሌ ቀይር',

  // ─── Greetings & journey ───
  'Good morning': 'እንደምን አደሩ',
  'Good afternoon': 'እንደምን ዋሉ',
  'Good evening': 'እንደምን አመሹ',
  'Welcome back to your home journey.': 'ወደ የቤት ጉዞዎ እንኳን ደህና መጡ።',
  'Your Home Journey': 'የእርስዎ የቤት ጉዞ',
  'Discovered': 'ተገኘ',
  'Living Here': 'እዚህ ይኖራሉ',
  'Neighborhoods': 'ቀበሌኞች',
  'ETHIOPIA': 'ኢትዮጵያ',

  // ─── Dashboard cards & empty states ───
  'No upcoming payment': 'ምንም የሚመጣ ክፍያ የለም',
  'When you rent a home, your next rent payment will appear here.': 'ቤት ስከራይ፣ ቀጣዩ የኪራይ ክፍያዎ እዚህ ይታያል።',
  'No payment history yet': 'ገና የክፍያ መዝገብ የለም',
  'Your payment record builds once your lease starts.': 'የክፍያ መዝገብዎ ኪራይ ስምምነትዎ ሲጀምር ይገነባል።',
  'No active lease': 'ንቁ ስምምነት የለም',
  'Once your application is approved and the agreement signed, your current home shows here.': 'ማመልከቻዎ ሲጸድቅና ስምምነቱ ሲፈረም፣ የአሁን ቤትዎ እዚህ ይታያል።',
  'Maintenance Requests': 'የጥገና ጥያቄዎች',
  'Maintenance request': 'የጥገና ጥያቄ',
  'My Current Home': 'የእኔ የአሁን ቤት',
  'Based on your budget, location, and bedroom preferences': 'በበጀትዎ፣ በአካባቢዎ እና በመኝታ ክፍል ምርጫዎ ላይ ተመስርቷል',
  'Rent Credit Score': 'የኪራይ ብድር ነጥብ',
  'Rent Payment': 'የኪራይ ክፍያ',
  'Next Payment': 'ቀጣይ ክፍያ',
  'View Invoice': 'ደረሰኝ ይመልከቱ',
  'View Invoices': 'ደረሰኞችን ይመልከቱ',
  'Pay Rent': 'ኪራይ ክፈል',
  'Request Maintenance': 'ጥገና ጠይቅ',
  'Leaking faucet': 'የፈሰሰ ቧንቧ',
  'Broken door lock': 'የተበላሸ የበር ቁልፍ',
  'AC not working': 'ኤሲ አይሰራም',
  'Completed on': 'ተጠናቋል በ',
  'Requested on': 'ተጠይቋል በ',

  // ─── Credit score tiers & breakdown ───
  'Excellent': 'በጣም ጥሩ',
  'Good': 'ጥሩ',
  'Fair': 'መካከለኛ',
  'Building': 'በመገንባት ላይ',
  'At Risk': 'በስጋት ላይ',
  'Hide details': 'ዝርዝሮችን ደብቅ',
  'How is this calculated?': 'እንዴት ይሰላል?',
  'On-time payments (0-400)': 'በጊዜው ክፍያዎች (0-400)',
  'Lease completion (0-300)': 'የስምምነት ማጠናቀቅ (0-300)',
  'Landlord reviews (0-300)': 'የባለቤት ግምገማዎች (0-300)',
  'pts': 'ነጥብ',
  'Last updated': 'በመጨረሻ የተዘመነው',

  // ─── Maintenance statuses & AI reasons ───
  'Submitted': 'የቀረበ',
  'In Progress': 'በሂደት ላይ',
  'Assigned': 'ተመድቧል',
  'Within your budget': 'በበጀትዎ ውስጥ',
  'Slightly above budget': 'ከበጀትዎ በላይ በትንሹ',
  'Verified listing': 'የተረጋገጠ ዝርዝር',

  // ─── Account / footer extras ───
  'My Account': 'የእኔ መለያ',
  'My Profile': 'የእኔ መገለጫ',
  'Account Settings': 'የመለያ ቅንብሮች',
  'Tenant Guide': 'የተከራይ መመሪያ',
  'Tenant Rights': 'የተከራይ መብቶች',
  'Contact Support': 'ድጋፍ ያግኙ',
  'Resources': 'ሀብቶች',
  'Legal': 'ሕጋዊ',

  // ─── Auth / modals / details ───
  'Sign In': 'ግባ',
  'Welcome Back': 'እንኳን ደህና መጡ',
  'Forgot your password?': 'የይለፍ ቃልዎን ረሱ?',
  'Forgot?': 'ረሱ?',
  'Remember me': 'አስታውሱኝ',
  'Sign in to your account to continue': 'ወደ መለያዎ ይግቡ እና ይቀጥሉ',
  'Remember me for 30 days': 'ለ30 ቀናት አስታውሱኝ',
  "Don't have an account? Create one": 'መለያ የለዎትም? ይፍጠሩ',
  'Create one': 'ይፍጠሩ',
  "Don't have an account?": 'መለያ የለዎትም?',
  'continue': 'ይቀጥሉ',
  'days': 'ቀናት',
  'Create Account': 'መለያ ይፍጠሩ',
  'Rental Application': 'የኪራይ ማመልከቻ',
  'Schedule a Viewing': 'የመመልከቻ ቀጠሮ ያስይዙ',
  'Application submitted': 'ማመልከቻ ተልኳል',
  'Viewing requested': 'የመመልከቻ ጥያቄ ተልኳል',
  'Message sent': 'መልእክት ተልኳል',
  'Message': 'መልእክት',
  'Move-in date': 'የመግቢያ ቀን',
  'Employment status': 'የሥራ ሁኔታ',
  'Monthly income': 'ወርሃዊ ገቢ',
  'Preferred date': 'የሚመርጡት ቀን',
  'Time': 'ሰዓት',
  'Amenities & Features': 'አገልግሎቶች እና ባህሪያት',
  'Rent this home': 'ይህን ቤት ይከራዩ',
  'per month': 'በወር',
  'Available now': 'አሁን ያለበት',
  'Water included': 'ውሃ ተካቷል',
  'Internet': 'ኢንተርኔት',
  'Parking': 'ፓርኪንግ',
  'Generator': 'ጀነሬተር',
  'Security': 'ደህንነት',
  'Balcony': 'ባልኮኒ',
  'Garden': 'አትክልት',
  'Similar homes': 'ተመሳሳይ ቤቶች',
  'Overview': 'አጠቃላይ እይታ',
  'Contact': 'ያግኙ',
  'Report this listing': 'ይህን ዝርዝር አሳውቅ',
  'Total revenue': 'ጠቅላላ ገቢ',
  'Monthly revenue': 'ወርሃዊ ገቢ',
  'Occupancy': 'የመኖሪያ መጠን',
  'Add Property': 'ንብረት ጨምር',
  'New users': 'አዳዲስ ተጠቃሚዎች',
  'Pending verifications': 'በመጠባበቅ ላይ ያሉ ማረጋገጫዎች',
  'Recent activity': 'የቅርብ ጊዜ እንቅስቃሴ',
  'Frequently Asked Questions': 'የተለዩ ጥያቄዎች',
  'Getting started': 'ማጀመር',
  'Account': 'መለያ',

  // ─── Word-level pass (covers titles, subs, leftovers) ───
  'Bedroom': 'መኝታ ክፍል',
  'bed': 'መኝታ',
  'beds': 'መኝታዎች',
  'bath': 'መታጠቢያ',
  'baths': 'መታጠቢያዎች',
  'Modern': 'ሞደርን',
  'Spacious': 'ሰፊ',
  'Executive': 'ልዩ',
  'Luxury': 'ቅንጦት',
  'Bright': 'ብሩህ',
  'Cozy': 'ምቹ',
  'Beautiful': 'ቆንጆ',
  'Beautiful views': 'ቆንጆ እይታዎች',
  'Hub': 'ማዕከል',
  'airport': 'አውሮፕላን ማረፊያ',
  'Restaurants': 'ምግብ ቤቶች',
  'embassies': 'ኤምባሲዎች',
  'business': 'ንግድ',
  'Central': 'መካከለኛ',
  'district': 'አካባቢ',
  'everything': 'ሁሉም ነገር',
  'close': 'ቅርብ',
  'Residential': 'የመኖሪያ',
  'families': 'ቤተሰቦች',
  'Great': 'ጥሩ',
  'Historic': 'ታሪካዊ',
  'downtown': 'የከተማ ማዕከል',
  'Traditional': 'ባህላዊ',
  'vibrant': 'ሕያው',
  'Lakeside': 'የሐይቅ ጠርኝ',
  'city': 'ከተማ',
  'Monasteries': 'ገዳማት',
  'Falls': 'ፏፏቴዎች',
  'French': 'ፈረንሳዊ',
  'colonial': 'ቅኝ ግዛት',
  'architecture': 'ሕንጻ ስርዓት',
  'near': 'አቅራቢያ',
  'with': 'ጋር',
  'and': 'እና',
  'or': 'ወይም',
  'your': 'የእርስዎ',
  'Your': 'የእርስዎ',
  'you': 'እርስዎ',
  'for': 'ለ',
  'from': 'ከ',
  'in': 'በ',
  'the': 'የ',
  'of': 'የ',
  'to': 'ወደ',
  'a': 'አንድ',
  'new': 'አዲስ',
  'all': 'ሁሉንም',
  'more': 'ተጨማሪ',
  'view': 'ይመልከቱ',
  'views': 'እይታዎች',
  'see': 'ይመልከቱ',
  'high-speed': 'ከፍተኛ ፍጥነት',
  'near the airport': 'አውሮፕላን ማረፊያ አቅራቢያ',
  'Close to everything': 'ለሁሉም ነገር ቅርብ',
  'Great for families': 'ለቤተሰቦች ተስማሚ',
  'Central business district': 'የመካከለኛ ንግድ አካባቢ',
  'Historic downtown': 'ታሪካዊ የከተማ ማዕከል',
  'Blue Nile Falls': 'የጥቁር አባይ ፏፏቴ',
  'water tank': 'የውሃ ማጠራቀሚያ',
  'home': 'ቤት',
  'homes': 'ቤቶች',
  'apartment': 'አፓርትመንት',
  'Bole': 'ቦሌ',
  'Kazanchis': 'ካዛንቺስ',
  'CMC': 'ሲኤምሲ',
  'Piassa': 'ፒያሳ',
  'Old Airport': 'የድሮ አውሮፕላን ማረፊያ',
  'Hawassa': 'ሀዋሳ',
  'Bahir Dar': 'ባህር ዳር',
  'Dire Dawa': 'ድሬዳዋ',
  'Mekelle': 'መቀሌ',
  'Gondar': 'ጎንደር',
  'Adama': 'አዳማ',
  'Jimma': 'ጅማ',
  'Dessie': 'ደሴ',
  'Arba Minch': 'አርባ ምንጭ',
  'Ethiopia': 'ኢትዮጵያ',

  // ─── How it works page ───
  'Transparent & Trusted': 'ግሉጥ እና የታመነ',
  'How HomeLink Ethiopia Works': 'ሆምሊንክ ኢትዮጵያ እንዴት እንደሚሰራ',
  'A digital housing ecosystem built to close the coordination and trust gap across Ethiopia’s residential rental market.': 'በኢትዮጵያ የመኖሪያ ቤት ኪራይ ገበያ ውስጥ ያለውን የመተባበርና የመተማመን እጥረት ለመዝጋት የተሰራ ዲጂታል የቤት ስርዓት።',
  'For Tenants': 'ለተከራዮች',
  'For Landlords': 'ለባለቤቶች',
  'Discover & Compare': 'ያግኙ እና ያነጻጽሩ',
  'Search verified apartments and houses with genuine pricing in ETB, clear photo galleries, and real neighborhood coordinates.': 'እውነተኛ ዋጋ በብር፣ ግሉጥ የፎቶ መደቦች እና እውነተኛ የአካባቢ መገኛ አድራሻ ያላቸውን የተረጋገጡ አፓርትመንቶችና ቤቶች ይፈልጉ።',
  'AI Fair-Rent Estimate': 'የAI ፍትሃዊ የኪራይ ግመታ',
  'Review our responsible AI rent estimates to understand market norms before committing or submitting an application.': 'ከመወሰንዎ ወይም ከማመልከትዎ በፊት የገበያውን ደረጃ ለመረዳት በኃላፊነት የተሰራውን የAI የኪራይ ግመታ ይመልከቱ።',
  'Schedule Viewings & Apply': 'የመመልከቻ ቀጠሮ ያዙ እና ያመልክቱ',
  'Book viewing appointments directly and submit your digital rental application with verified proof of identity.': 'የመመልከቻ ቀጠሮዎችን በቀጥታ ያስይዙ እና የተረጋገጠ የማንነት ማረጋገጫ ጋር የኪራይ ማመልከቻዎን ያስገቡ።',
  'Digital Tenancy & Payments': 'ዲጂታል የኪራይ ስምምነት እና ክፍያዎች',
  'Sign your digital rental agreement, record monthly rent payments, and submit maintenance tickets with real-time status tracking.': 'የኪራይ ስምምነትዎን በዲጂታል ይፈርሙ፣ ወርሃዊ ኪራይ ክፍያዎችን ይመዝግቡ እና በቅጽበታዊ ክትትል የጥገና ጥያቄዎችን ያስገቡ።',
  'List & Submit Verification': 'ይዝረዝሩ እና ማረጋገጫ ያስገቡ',
  'List properties with room layouts, amenities, and rent details. Submit ownership verification documents for trust badge approval.': 'ክፍሎችን፣ አገልግሎቶችን እና የኪራይ ዝርዝሮችን ጨምረው ንብረቶችዎን ይዝረዝሩ። የባለቤትነት ማረጋገጫ ሰነዶችን ለታመነ ምልክት ያስገቡ።',
  'Review Applications': 'ማመልከቻዎችን ይገምግሙ',
  'Inspect applicant profiles on an interactive Kanban board, request background info, and approve qualified tenants.': 'የአመልካቾችን መገለጫዎች በኢንተራክቲቭ ቦርድ ይመልከቱ፣ ተጨማሪ መረጃ ይጠይቁ እና ብቁ ተከራዮችን ያጽድቁ።',
  'Track Payments & Rent': 'ክፍያዎችን እና ኪራይ ይከታተሉ',
  'Monitor rent collections, automated receipt logs, overdue reminders, and collection rate metrics in your dashboard.': 'የኪራይ ገቢዎችን፣ ራስ-ሰር ደረሰኝ መዝገቦችን፣ የመዘግየት አስታዋሾችን እና የገቢ መረጃዎችን በዳሽቦርድዎ ይከታተሉ።',
  'Manage Maintenance': 'ጥገና ያስተዳድሩ',
  'Receive tenant maintenance requests, assign registered local service providers, and mark issues resolved.': 'የተከራዮችን የጥገና ጥያቄዎች ይቀበሉ፣ የተመዘገቡ የአካባቢ አገልግሎት ሰጪዎችን ይመድቡ እና ችግሮችን እንደተፈቱ ይምልከቱ።',
  'Explore Verified Homes': 'የተረጋገጡ ቤቶችን ያስሱ',
  'Explore Available Homes': 'ያሉ ቤቶችን ያስሱ',

  // ─── Support / FAQ page ───
  'Help & Support': 'እገዛ እና ድጋፍ',
  'Find answers to common questions about verification, renting, payments, and platform security.': 'ስለ ማረጋገጫ፣ ኪራይ፣ ክፍያዎች እና የመድረክ ደህንነት የተለመዱ ጥያቄዎች መልሶችን ያግኙ።',
  'How does landlord and property verification work?': 'የባለቤት እና የንብረት ማረጋገጫ እንዴት ይሰራል?',
  'Landlords upload government-issued ID and property ownership documents (e.g. Title Deed or Lease Agreement). Our platform administrators review the documents before awarding the Verified badge.': 'ባለቤቶች የመንግሥት መታወቂያ እና የባለቤትነት ሰነዶችን (ለምሳሌ የባለቤትነት ማረጋገጫ ወይም የኪራይ ስምምነት) ያስገባሉ። አስተዳዳሪዎቻችን የ"የተረጋገጠ" ምልክቱን ከመስጠታቸው በፊት ሰነዶቹን ይገምግማሉ።',
  'How is the AI Fair-Rent Estimate calculated?': 'የAI ፍትሃዊ የኪራይ ግመታ እንዴት ይሰላል?',
  'Our regression model estimates rental-price ranges based on location, square meters, bedrooms, amenities, and verified market comparables in Addis Ababa. It is labeled as an estimate, not an official appraisal.': 'ሞዴላችን በአዲስ አበባ በአካባቢ፣ በስፋት፣ በመኝታ ክፍሎች፣ በአገልግሎቶች እና በተረጋገጡ የገበያ ንጽጽሮች ላይ የተመሠረተ የኪራይ ዋጋ ግመታ ያመነጫል። ኦፊሴላዊ ግምት ሳይሆን እንደ ግመታ ብቻ ነው።',
  'What should I do if I suspect a fraudulent listing?': 'ዝርዝሩ የተጠረጠረ ከሆነ ምን ማድረግ አለብኝ?',
  'Click the "Report this listing" button on any property page or open the Fraud Reporting dialog. Our Trust & Safety team investigates flagged accounts immediately.': 'በማንኛውም የንብረት ገጽ ላይ ያለውን "ይህን ዝርዝር አሳውቅ" ቁልፍ ይጫኑ። የእምነትና ደህንነት ቡድናችን ተኰንዋይ መለያዎችን ወዲያውኑ ይመረምራል።',
  'Can I pay my rent online via HomeLink Ethiopia?': 'ኪራይን በኦንላይን በሆምሊንክ ኢትዮጵያ መክፈል እችላለሁ?',
  'Yes, our platform records monthly rent obligations, payment receipts, and balance ledgers, with support for local digital banking channels (e.g. Telebirr, CBE Birr).': 'አዎ፣ መድረካችን ወርሃዊ የኪራይ ግዴታዎችን፣ የክፍያ ደረሰኞችን እና ቀሪ ሂሳብ መዝገቦችን ይይዛል፤ ለሎካል ዲጂታል ባንኪንግ (ቴሌብር፣ CBE ብር) ይደገፋል።',
  'Still have questions?': 'አሁንም ጥያቄዎች አሉዎት?',
  'Send our support team a direct message.': 'ለድጋፍ ቡድናችን በቀጥታ መልእክት ይላኩ።',
  'YOUR NAME': 'የእርስዎ ስም',
  'Your Name': 'የእርስዎ ስም',
  'PHONE / EMAIL': 'ስልክ / ኢሜይል',
  'Phone / Email': 'ስልክ / ኢሜይል',
  'HOW CAN WE HELP?': 'እንዴት እንረዳዎት?',
  'How can we help?': 'እንዴት እንረዳዎት?',
  'Send Message': 'መልእክት ላክ',
  'Thank you! Your message has been received. Our team will contact you shortly.': 'አመሰግናለሁ! መልእክትዎ ደርሶናል። ቡድናችን በቅርቡ ያግኝዎታል።',
  'Describe your inquiry or issue...': 'ጥያቄዎን ወይም ችግርዎን ይግለጹ...',

  // ─── About page ───
  'Our Mission': 'ተልዕኮአችን',
  'A Trusted Digital Housing Ecosystem for Ethiopia': 'ለኢትዮጵያ የታመነ ዲጂታል የቤት ኪራይ ስርዓት',
  'HomeLink Ethiopia closes the critical digital coordination and trust gap within the national rental process.': 'ሆምሊንክ ኢትዮጵያ በብሔራዊ የኪራይ ሂደት ውስጥ ያለውን የዲጂታል መተባበርና የመተማመን እጥረት ይዘጋል።',
  'National Problem & Context': 'ብሔራዊ ችግር እና ሁኔታ',
  'Ethiopia is undergoing rapid urbanization, increasing pressure on urban housing. UN-Habitat and the World Bank have documented significant urban housing deficits. The existing rental market remains fragmented—relying on disconnected listings, informal brokers, and paper records.': 'ኢትዮጵያ ፈጣን የከተማ ልማት እያሳለፈች ሲሆን ይህም በከተማ ቤቶች ላይ ግፊት ይጨምራል። ዩኤን-ሀቢታት እና የዓለም ባንክ ከፍተኛ የከተማ ቤት እጥረት መኖሩን አረጋግጠዋል። ነባሩ የኪራይ ገበያ እስካሁን ተበታትኗል—በተነጣጠሉ ዝርዝሮች፣ በኢንፎርማል ደላሎች እና በወረቀት መዝገቦች ላይ የተመሠረተ።',
  'HomeLink Ethiopia provides digital trust infrastructure: verified landlord and property evidence, responsible AI fair-rent estimation, automated digital tenancy agreements, and structured dispute & maintenance resolution.': 'ሆምሊንክ ኢትዮጵያ ዲጂታል የእምነት መሠረተ ልማት ይሰጣል፡ የተረጋገጡ የባለቤት እና የንብረት ማስረጃዎች፣ በኃላፊነት የተሰራ የAI ፍትሃዊ የኪራይ ግመታ፣ ራስ-ሰር ዲጂታል የኪራይ ስምምነቶች እና የተደራጀ የክርክርና የጥገና ፍታ።',
  '01. Transparency': '01. ግልጽነት',
  'Verified Listings': 'የተረጋገጡ ዝርዝሮች',
  'Every property and landlord passes verification checkpoints to prevent duplicate listings and scams.': 'ብዙ ዝርዝሮችን እና ማጭበርበሮችን ለመከላከል እያንዳንዱ ንብረት እና ባለቤት የማረጋገጫ ደረጃዎችን ያልፋል።',
  '02. Responsible AI': '02. በኃላፊነት የተሰራ AI',
  'Fair-Rent & Safety': 'ፍትሃዊ ኪራይ እና ደህንነት',
  'Objective AI rent estimates and fraud-risk detection empower human decision-makers.': 'ታማኝ የAI የኪራይ ግመታዎች እና የማጭበርበር ስጋት መለየት የሰው ውሳኔ ሰጪዎችን ያስችላል።',
  '03. Full Lifecycle': '03. ሙሉ ዑደት',
  'Digital Tenancy': 'ዲጂታል የኪራይ ስምምነት',
  'From discovery and viewing to agreements, rent records, and maintenance follow-up.': 'ከመገኘት እና ከመመልከት እስከ ስምምነቶች፣ የኪራይ መዝገቦች እና የጥገና ክትትል።',

  // ─── Get started page ───
  'Welcome to HomeLink Ethiopia': 'ወደ ሆምሊንክ ኢትዮጵያ እንኳን ደህና መጡ',
  'Choose Your Role': 'ሚናዎን ይምረጡ',
  'Select how you\'ll be using HomeLink to access your personalized workspace.': 'የራስዎን የሥራ ቦታ ለመድረስ ሆምሊንክን እንዴት እንደሚጠቀሙ ይምረጡ።',
  'I am a Tenant': 'ተከራይ ነኝ',
  'Find your perfect verified home and manage your tenancy.': 'ፍጹም የተረጋገጠ ቤትዎን ያግኙ እና የኪራይ ሂደትዎን ያስተዳድሩ።',
  'Browse & filter verified listings': 'የተረጋገጡ ዝርዝሮችን ያስሱ እና ያጣሩ',
  'AI-powered home matching': 'በAI የተመሠረተ የቤት መመሳከር',
  'Digital rental applications': 'ዲጂታል የኪራይ ማመልከቻዎች',
  'Rent payment tracking': 'የኪራይ ክፍያ ክትትል',
  'Maintenance ticket submission': 'የጥገና ጥያቄ ማስገባት',
  'Get Started as Tenant': 'እንደ ተከራይ ይጀምሩ',
  'I am a Landlord': 'ባለቤት ነኝ',
  'List, verify, and manage your properties in one place.': 'ንብረቶችዎን በአንድ ቦታ ይዝረዝሩ፣ ያረጋግጡ እና ያስተዳድሩ።',
  'List & verify properties': 'ንብረቶችን ይዝረዝሩ እና ያረጋግጡ',
  'Review applicant pipelines': 'የአመልካቾችን ዝርዝር ይገምግሙ',
  'Track rent collection': 'የኪራይ ገቢን ይከታተሉ',
  'Manage maintenance tickets': 'የጥገና ጥያቄዎችን ያስተዳድሩ',
  'Digital lease agreements': 'ዲጂታል የኪራይ ስምምነቶች',
  'Get Started as Landlord': 'እንደ ባለቤት ይጀምሩ',
  'Already have an account?': 'መለያ አለዎት?',
  'Sign in →': 'ይግቡ →',
  'browse properties': 'ንብረቶችን ያስሱ',
  'Trusted by thousands': 'በሺዎች ተመኝ',
  "Ethiopia's Most Trusted Rental Platform": 'በኢትዮጵያ ውስጥ በጣም የታመነ የኪራይ መድረክ',
  '12,400+ verified listings. 6,300+ verified landlords. 98% tenant satisfaction. Built on transparency.': '12,400+ የተረጋገጡ ዝርዝሮች። 6,300+ የተረጋገጡ ባለቤቶች። 98% የተከራይ እርካታ። በግልጽነት ላይ የተመሠረተ።',
  'ETB transparent pricing': 'ግሉጥ የብር ዋጋ',
  'Zero fake listings': 'ምንም የተጠረጠሩ ዝርዝሮች የሉም',
  'Secure digital agreements': 'ደህንነቱ የተጠበቁ ዲጂታል ስምምነቶች',

  // ─── List property info page ───
  'Landlord Portal': 'የባለቤት መግቢያ',
  'To list a property on HomeLink Ethiopia, you need a landlord account. Our verification process ensures tenants trust your listings.': 'በሆምሊንክ ኢትዮጵያ ላይ ንብረት ለማስቀመጥ የባለቤት መለያ ያስፈልግዎታል። የማረጋገጫ ሂደታችን ተከራዮች ዝርዝሮችዎን እንዲያመኑ ያደርጋል።',
  'How it works:': 'እንዴት እንደሚሰራ፡',
  'Create a Landlord Account': 'የባለቤት መለያ ይፍጠሩ',
  'Create Landlord Account': 'የባለቤት መለያ ይፍጠሩ',
  'Sign up and select "I have properties to rent"': 'ይመዝገቡ እና "ለኪራይ ንብረቶች አሉኝ" ይምረጡ',
  'Get Verified': 'ማረጋገጫ ያግኙ',
  'Upload your identity and ownership documents': 'የማንነት እና የባለቤትነት ሰነዶችዎን ያስገቡ',
  'Add details, photos, and set your price': 'ዝርዝሮችን እና ፎቶዎችን ጨምረው ዋጋዎን ይውሰኑ',

  // ─── AI transparency page ───
  'Responsible AI': 'በኃላፊነት የተሰራ AI',
  'How HomeLink uses AI — and where it stops': 'ሆምሊንክ AIን እንዴት እንደሚጠቀም — እና የሚቆምበት ድንበር',
  'HomeLink uses simple, explainable calculations — not black-box models. Every score can be traced to real inputs, and important decisions are always made by people. Here is exactly what that means.': 'ሆምሊንክ ቀላል፣ ሊረዱ የሚችሉ ስሌቶችን ይጠቀማል — ጥቁር ሳጥን ሞዴሎችን አይደሉም። እያንዳንዱ ነጥብ ወደ እውነተኛ መረጃዎች ሊተረጎም ይችላል፣ አስፈላጊ ውሳኔዎችም ሁልጊዜ በሰው ይመራሉ። ማለትም ይህ ነው።',
  'What data the AI uses': 'AI የሚጠቀምባቸው መረጃዎች',
  'For matching: only the preferences you enter — budget, preferred city/sub-city, property type, bedrooms, amenities. We do not use your race, religion, gender, or any other protected characteristic, and we do not profile you from other behavior.': 'ለመመሳከር፡ የሚያስገቡት ምርጫዎች ብቻ — በጀት፣ የሚመርጡት ከተማ/ክፍለ ከተማ፣ የንብረት ዓይነት፣ መኝታ ክፍሎች፣ አገልግሎቶች። ዘርዎን፣ ሃይማኖትዎን፣ ጾታዎን ወይም ሌላ የተጠበቀ ባህርያትዎን አንጠቀምም፤ ከሌላ ባህሪ ጭምር መገለጫዎን አንፈጥርም።',
  'For rent estimates: real comparable listings on HomeLink — same city and property type, with adjustments for bedrooms, size and amenities. No external or invented data.': 'ለኪራይ ግመታ፡ በሆምሊንክ ላይ ያሉ እውነተኛ ተመሳሳይ ዝርዝሮች — ተመሳሳይ ከተማ እና የንብረት ዓይነት፣ በመኝታ ክፍሎች፣ በስፋት እና በአገልግሎቶች ተስተካክለው። የውጭ ወይም የተፈጠሩ መረጃዎች የሉም።',
  'For fraud risk: report counts, duplicate images across listings, how a price compares to the area average, verification status and listing age.': 'ለማጭበርበር ስጋት፡ የሪፖርት ብዛት፣ በዝርዝሮች መካከል ተመሳሳይ ፎቶዎች፣ ዋጋ ከአካባቢው አማካይ ጋር ስለሚስማማ፣ የማረጋገጫ ሁኔታ እና የዝርዝር ዕድሜ።',
  'What the AI decides': 'AI የሚወስነው',
  'The order of property suggestions in your match list.': 'በመመሳከር ዝርዝርዎ ውስጥ የንብረት አስተያየቶች ቅደም ተከተል።',
  'The estimated rent range shown on the Add Property form.': 'በንብረት መጨመሪያ ቅጽ ላይ የሚታየው የኪራይ ግመታ ክልል።',
  'The order of the admin review queue for suspicious listings.': 'ለተጠረጠሩ ዝርዝሮች የአስተዳዳሪ ግምገማ ሰልፍ ቅደም ተከተል።',
  'What the AI does NOT decide': 'AI የማይወስነው',
  'It never bans, suspends or restricts any account.': 'በጭራሽ ምንም መለያ አያገድም፣ አያቆምም ወይም አይገድብም።',
  'It never approves or rejects a landlord or property verification.': 'በጭራሽ የባለቤት ወይም የንብረት ማረጋገጫን አያጽድቅም ወይም አይውድቅም።',
  'It never hides or removes a listing on its own.': 'በጭራሽ በራሱ ዝርዝር አይደብቅም ወይም አያስወግድም።',
  'It never sets your rent — the estimate is guidance, the final price is agreed between landlord and tenant.': 'በጭራሽ ኪራይዎን አያስቀምጥም — ግመታው መመሪያ ብቻ ነው፣ የመጨረሻው ዋጋ በባለቤትና በተከራይ ይስማማሉ።',
  'Human review process': 'የሰው ግምገማ ሂደት',
  'Every high-risk listing flagged by the fraud model goes to a human admin, who investigates, records a decision and a written reason.': 'በማጭበርበር ሞዴል የተሰየመ እያንዳንዱ ከፍተኛ ስጋት ያለው ዝርዝር ወደ ሰው አስተዳዳሪ ይሄዳል፤ እሱም ይመረምራል፣ ውሳኔ እና የተጻፈ ምክንያት ይመዝግባል።',
  'Dispute resolutions and account suspensions are always decided by admins and recorded in the audit trail (who, what changed, when, decision, reason).': 'የክርክር ፍታዎች እና የመለያ ማቆሚያዎች ሁልጊዜ በአስተዳዳሪዎች ይወሰናሉ እና በኦዲት መዝገብ (ማን፣ ምን እንደተቀየረ፣ መቼ፣ ውሳኔ፣ ምክንያት) ይመዘገባሉ።',
  'If you disagree with a decision, you can file a dispute and a human mediator reviews it.': 'ከውሳኔው ጋር ካልስማሙ፣ ክርክር መክፈት ይችላሉ እና የሰው መላኪያ ይገምግመዋል።',
  'Confidence and uncertainty': 'የግመታ እምነት እና ተለዋዋጭነት',
  'Match results show every factor score (budget, location, type, bedrooms, amenities, availability) and plain-language reasons — including the negatives — so you can judge for yourself.': 'የመመሳከር ውጤቶች የእያንዳንዱን ነጥብ (በጀት፣ አካባቢ፣ ዓይነት፣ መኝታ ክፍሎች፣ አገልግሎቶች፣ አለበት) እና በቀላል ቋንቋ ምክንያቶች — አሉታዊዎችን ጨምሮ — ያሳያሉ፤ እርስዎ ራስዎ እንዲወስኑ።',
  'Rent estimates state how many comparable listings they are based on and a confidence level (high ≥ 15 comparables, medium ≥ 7, low otherwise). Small samples mean wide ranges.': 'የኪራይ ግመታዎች በስንት ተመሳሳይ ዝርዝሮች ላይ እንደተመሠረቱ እና የእምነት ደረጃን (ከፍተኛ ≥ 15፣ መካከለኛ ≥ 7፣ አለበለዚያ ዝቅተኛ) ይገልጻሉ። አነስተኛ ናሙና ሰፊ ክልል ማለት ነው።',
  'If there is not enough real data, the AI says so instead of inventing a number.': 'በቂ እውነተኛ መረጃ ከሌለ፣ AI ቁጥር ከመፍጠር ይልቅ ይናገራል።',
  'Questions about how a score was calculated for you?': 'ነጥብ ለእርስዎ እንዴት እንደሰላ ጥያቄ አለዎት?',
  'File a dispute': 'ክርክር ክፈት',
  'and a human on our team will walk you through it.': 'እና ቡድናችን ሰው ይመራዎታል።',
  'Your account information': 'የእርስዎ መለያ መረጃ',
  'First name': 'የመጀመሪያ ስም',
  'Last name': 'የአባት ስም',
  'cannot be changed': 'ሊቀየር አይችልም',
  'changes': 'ለውጦች',
  'Profile updated.': 'መገለጫ ተዘምኗል።',
  'Not verified': 'አልተረጋገጠም',
  'Email verified': 'ኢሜይል የተረጋገጠ',
  'requests': 'ጥያቄዎች',
}

/** Amharic UI phrases that must NOT be re-translated when locale is AM. */
const isAmharic = (s: string) => /[\u1200-\u137F]/.test(s)

/** Tags whose text content must never be touched. */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE'])

/** Case-insensitive lookup index (CSS often uppercases/lowercases via text-transform). */
const DICT_LOWER: Record<string, string> = {}
for (const [k, v] of Object.entries(UI_DICTIONARY)) {
  const lk = k.toLowerCase()
  if (!(lk in DICT_LOWER)) DICT_LOWER[lk] = v
}

function lookup(key: string): string | undefined {
  if (key in UI_DICTIONARY) return UI_DICTIONARY[key]
  return DICT_LOWER[key.toLowerCase()]
}

/** Multi-word dictionary phrases, longest first, for substring substitution. */
const PHRASE_KEYS: [string, string][] = Object.entries(UI_DICTIONARY)
  .filter(([k]) => k.includes(' '))
  .sort((a, b) => b[0].length - a[0].length)

/** Replace the first case-insensitive occurrence of `phrase` in `hay`. */
function replacePhrase(hay: string, phrase: string, tr: string): string {
  const idx = hay.toLowerCase().indexOf(phrase.toLowerCase())
  if (idx === -1) return hay
  return hay.slice(0, idx) + tr + hay.slice(idx + phrase.length)
}

/**
 * Translate ONE text node by mutating its nodeValue in place.
 *
 * CRITICAL: we never insert/remove/replace DOM nodes — React owns the tree
 * and any structural change behind its back causes
 * "NotFoundError: Failed to execute 'insertBefore' on 'Node'" during commits
 * (node references go stale). Mutating `nodeValue` is invisible to React's
 * diffing and can never invalidate its references.
 */
function translateTextNode(textNode: Text) {
  const content = textNode.nodeValue ?? ''
  if (!content.trim() || isAmharic(content)) return
  const parent = textNode.parentElement
  if (!parent || SKIP_TAGS.has(parent.tagName) || parent.isContentEditable) return

  const normalized = content.trim().replace(/\s+/g, ' ')
  snapshotNode(textNode)

  // Pass 1 — exact phrase match on the whole node.
  const exact = lookup(normalized)
  if (exact) {
    textNode.nodeValue = content.replace(normalized, exact)
    return
  }

  // Pass 1.5 — multi-word phrase substitution inside longer text
  // (e.g. "near the airport" inside a neighborhood subtitle). Doesn't
  // return early — the word pass below still handles the remaining words.
  let text = content
  for (const [phrase, tr] of PHRASE_KEYS) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      text = replacePhrase(text, phrase, tr)
    }
  }

  // Pass 2 — word-level fallback: rebuild the node by splitting it into
  // words/punctuation and translating each word individually. Separators
  // (spaces, ·, —, Amharic text) are preserved verbatim, so mixed content
  // like "Bole · 2 bed · 1 bath" or "ETB 42,000 / month" translates well.
  if (!/[A-Za-z]{2,}/.test(text)) {
    if (text !== content) textNode.nodeValue = text
    return
  }

  const parts = text.split(/([A-Za-z][A-Za-z'’-]*)/g)
  let changed = text !== content
  for (let i = 0; i < parts.length; i++) {
    const word = parts[i]
    if (!word || !/^[A-Za-z]/.test(word)) continue
    const hit = lookup(word.replace(/[.,!?;:]+$/, ''))
    if (hit) {
      parts[i] = hit
      changed = true
    }
  }
  if (changed) textNode.nodeValue = parts.join('')
}

/** Translate translatable attributes on every element under `root`. */
function translateAttributes(root: ParentNode) {
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'] as const
  const els = (root as Element).querySelectorAll?.('[placeholder], [aria-label], [title], [alt]') ?? []
  els.forEach((el) => {
    for (const attr of ATTRS) {
      const val = el.getAttribute(attr)
      if (!val || isAmharic(val)) continue
      const key = val.trim().replace(/\s+/g, ' ')
      const hit = lookup(key)
      if (hit) el.setAttribute(attr, hit)
    }
  })
}

/** Walk all text nodes under `root` and swap dictionary matches in place. */
function translateTree(root: ParentNode, dict: Record<string, string>) {
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let node: Node | null
    while ((node = walker.nextNode())) nodes.push(node as Text)
    for (const n of nodes) translateTextNode(n)
    translateAttributes(root)
  } catch { /* root detached mid-walk */ }
}

/**
 * Restore original English. `originals` maps each text node to the exact
 * nodeValue it had before translation, so recovery is a pure value write.
 */
const originals = new WeakMap<Text, string>()

/**
 * Record React's current English as the restore point for this node.
 * Skips when the current value is Amharic (that's our own write — the
 * stored original is still the valid English source).
 */
function snapshotNode(t: Text) {
  const cur = t.nodeValue ?? ''
  if (isAmharic(cur)) return
  originals.set(t, cur)
}

function restoreEnglish() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) nodes.push(node as Text)
  for (const t of nodes) {
    const orig = originals.get(t)
    if (orig !== undefined) {
      t.nodeValue = orig
      originals.delete(t)
    }
  }
}

export default function AutoTranslate() {
  const { locale } = useLanguage()

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.body

    if (locale === 'AM') {
      translateTree(root, UI_DICTIONARY)
      const mo = new MutationObserver((muts) => {
        for (const m of muts) {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1) {
              translateTree(n as Element, UI_DICTIONARY)
            } else if (n.nodeType === 3) {
              const t = n as Text
              snapshotNode(t)
              translateTextNode(t)
            }
          })
          if (m.type === 'characterData' && m.target.nodeType === 3) {
            const t = m.target as Text
            // React wrote new English content into a node we translated
            // before — refresh the snapshot and re-translate.
            snapshotNode(t)
            translateTextNode(t)
          }
        }
      })
      mo.observe(root, { childList: true, subtree: true, characterData: true })
      return () => mo.disconnect()
    }

    // EN: restore original English text everywhere.
    restoreEnglish()
  }, [locale])

  return null
}
