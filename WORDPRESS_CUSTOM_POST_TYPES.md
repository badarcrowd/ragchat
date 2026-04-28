# WordPress Custom Post Types Reference

This is a reference for common WordPress custom post types you might encounter when crawling sites.

## 🔍 How to Find Custom Post Types

### Method 1: Visit the WordPress API
Go to: `https://yoursite.com/wp-json/wp/v2/types`

This will show all available post types on the site.

### Method 2: Auto-Discovery (Recommended)
The system now **automatically discovers** all post types! Just enable "Auto-discover all post types" (enabled by default).

## 📋 Common Custom Post Types

### E-commerce (WooCommerce)
- `product` - Products
- `shop_order` - Orders (usually private)
- `shop_coupon` - Coupons

### Portfolio/Gallery
- `portfolio` - Portfolio items
- `project` - Projects
- `jetpack-portfolio` - Jetpack portfolio
- `gallery` - Gallery items

### Team/Staff
- `team` - Team members
- `staff` - Staff profiles
- `employee` - Employees

### Testimonials/Reviews
- `testimonial` - Client testimonials
- `review` - Reviews

### Events
- `event` - Events
- `tribe_events` - The Events Calendar plugin
- `event_listing` - Event listings

### Services
- `service` - Services offered
- `our_services` - Company services

### Case Studies
- `case_study` - Case studies
- `case-study` - Case studies (alternate slug)

### FAQs
- `faq` - Frequently asked questions
- `question` - Q&A items

### Locations
- `location` - Physical locations
- `office` - Office locations

### Jobs/Careers
- `job` - Job postings
- `career` - Career opportunities

### Real Estate
- `property` - Properties
- `listing` - Real estate listings

### Custom Theme Types
- Check your theme documentation - many premium themes add their own types

## 💡 Usage Examples

### Example 1: Auto-Discovery (Easiest)
```
Site URL: https://yoursite.com
Custom Post Types: (leave empty)
☑ Auto-discover all post types
```
Result: Fetches pages, posts, and ALL custom types automatically!

### Example 2: Manual Specification
```
Site URL: https://yoursite.com
Custom Post Types: portfolio,team,testimonial
☑ Auto-discover all post types
```
Result: Fetches standard types + ensures portfolio, team, and testimonial are included

### Example 3: Only Specific Types
```
Site URL: https://yoursite.com
Custom Post Types: product,portfolio
☐ Auto-discover all post types (unchecked)
```
Result: Only fetches products and portfolio items (ignores pages/posts)

## 🎯 Best Practices

### For Most Sites
✅ **Enable auto-discovery** - The system will find everything automatically

### For Known Custom Types
✅ **Add them manually** - Guarantees they're included even if auto-discovery misses them

### For Large Sites
✅ **Be selective** - If you only need specific content types, disable auto-discovery and list only what you need

## 🔧 Troubleshooting

### "No content found"
- The WordPress REST API might be disabled
- Try adding `/wp-json/wp/v2` to your site URL in browser to test
- Some security plugins block the API

### Custom type not fetched
- Check the slug is correct at `https://yoursite.com/wp-json/wp/v2/types`
- Some post types are not public/viewable
- Try adding it manually in the "Custom Post Types" field

### Too many irrelevant items
- Disable auto-discovery
- Manually specify only the types you need

## 📊 What Gets Indexed

From each post type, we index:
- **Title** - Post/page title
- **Content** - Main content (HTML stripped)
- **URL** - Permalink
- **Type** - Post type slug (for filtering later)

**Excluded:**
- Attachments/Media
- Revisions
- Navigation menus
- Reusable blocks (wp_block)

## 🚀 Performance Tips

- Default limit: 100 items per post type
- Large sites may take 2-10 minutes
- The system processes all types in parallel
- Check terminal logs to see progress

## 📝 Common Slugs by Industry

### Marketing Agency
- case_study, testimonial, service, team

### E-commerce
- product, product_cat, shop_order

### Real Estate
- property, listing, agent

### Restaurant/Food
- menu_item, location, event

### SaaS/Tech
- feature, integration, resource, documentation

---

**Pro Tip:** Just enable auto-discovery and let the system handle it! It's smart enough to skip system types and only fetch content.
