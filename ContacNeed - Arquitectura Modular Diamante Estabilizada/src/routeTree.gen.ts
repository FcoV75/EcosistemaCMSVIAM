import { Route as rootRoute } from './routes/__root'
import { Route as indexRoute } from './routes/index'
import { Route as adminRoute } from './routes/admin'
import { Route as profileRoute } from './routes/profile'

export const routeTree = rootRoute.addChildren([
  indexRoute,
  adminRoute,
  profileRoute,
])
