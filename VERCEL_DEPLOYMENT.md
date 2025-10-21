# Vercel Deployment Guide for Student Retention System

## Prerequisites
- Vercel account (free tier available)
- MongoDB Atlas account with database set up
- Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Prepare Your Repository

1. **Push your code to a Git repository** (GitHub recommended for Vercel integration)

2. **Set up environment variables** in Vercel:
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Add the following variables:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/student_retention
NODE_ENV=production
JWT_SECRET=your_secure_jwt_secret_here
ALLOWED_ORIGINS=https://your-app-name.vercel.app
```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from your project directory
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No
# - Project name: student-retention
# - Directory: ./
# - Override settings? No
```

### Option B: Deploy via Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your Git repository
4. Vercel will auto-detect the configuration
5. Add environment variables in the dashboard
6. Click "Deploy"

## Step 3: Configure MongoDB Atlas

1. **Whitelist Vercel IPs** in MongoDB Atlas:
   - Go to Network Access in MongoDB Atlas
   - Add IP address: `0.0.0.0/0` (for all IPs) or specific Vercel IPs
   - Or use MongoDB Atlas Data API for better security

2. **Update connection string** if needed:
   - Ensure your MongoDB URI is correct
   - Test the connection from Vercel environment

## Step 4: Test Your Deployment

1. **Check the deployment URL** provided by Vercel
2. **Test the main pages**:
   - `/` - Home page
   - `/student-login.html` - Student login
   - `/advisor-login.html` - Advisor login
   - `/admin-dashboard.html` - Admin dashboard

3. **Test API endpoints**:
   - `/api/health` - Health check
   - `/api/data/csv-stats` - Statistics
   - `/api/data/csv-students` - Student data

## Step 5: Domain Configuration (Optional)

1. **Custom Domain**:
   - Go to Vercel project settings
   - Add your custom domain
   - Update DNS records as instructed

2. **Update CORS settings** if using custom domain:
   - Update `ALLOWED_ORIGINS` environment variable
   - Include your custom domain

## Troubleshooting

### Common Issues:

1. **MongoDB Connection Issues**:
   - Check MongoDB Atlas network access settings
   - Verify connection string format
   - Check environment variables in Vercel

2. **CORS Errors**:
   - Update `ALLOWED_ORIGINS` environment variable
   - Check server CORS configuration

3. **Static File Issues**:
   - Ensure `vercel.json` is configured correctly
   - Check file paths in the configuration

4. **API Route Issues**:
   - Verify all API routes are working
   - Check serverless function timeout settings

### Debug Steps:

1. **Check Vercel Function Logs**:
   - Go to Vercel dashboard → Functions tab
   - View real-time logs for debugging

2. **Test API endpoints directly**:
   - Use tools like Postman or curl
   - Test each endpoint individually

3. **Check Environment Variables**:
   - Verify all required variables are set
   - Check variable values are correct

## File Structure for Vercel

```
project-root/
├── vercel.json          # Vercel configuration
├── package.json         # Dependencies and scripts
├── env.example          # Environment variables example
├── server/
│   ├── index.js         # Main server file
│   ├── routes/          # API routes
│   ├── models/          # Database models
│   └── utils/           # Utility functions
├── public/              # Static files
│   ├── index.html
│   ├── student-login.html
│   ├── advisor-login.html
│   ├── student-dashboard.html
│   ├── advisor-dashboard.html
│   └── admin-dashboard.html
└── Datasets/            # CSV data files
```

## Performance Optimization

1. **Enable Vercel Analytics** (optional)
2. **Use Vercel Edge Functions** for better performance
3. **Optimize MongoDB queries** for serverless environment
4. **Implement caching** for frequently accessed data

## Security Considerations

1. **Environment Variables**: Never commit sensitive data to Git
2. **MongoDB Security**: Use proper authentication and network restrictions
3. **CORS Configuration**: Limit allowed origins to your domains
4. **Input Validation**: Ensure all API endpoints validate input data

## Support

- Vercel Documentation: https://vercel.com/docs
- MongoDB Atlas Documentation: https://docs.atlas.mongodb.com/
- Project Issues: Check the project repository for known issues
