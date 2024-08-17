const ROUTE_EXPIRATION_TIME = process.env.ROUTE_EXPIRY || 1000 * 60 * 60 * 24; // 1 day
export default class NetworkMap {
    constructor() {
        this.map = {};
    }

    async addRoutes(routesList) {
        let prevRoute = null;
        for (let route of routesList) {

            //Save connected routes
            if (prevRoute) {
                if (!this.map[route]) {
                    this.map[route] = [];
                }
                if (!this.map[prevRoute]) {
                    this.map[prevRoute] = [];
                }
                this.map[prevRoute].push({route, timestamp: +new Date()});
                this.map[route].push({route: prevRoute, timestamp: +new Date()});
            }

            prevRoute = route;
        }
    }

    async gc() {
        let now = +new Date();
        for (let route in this.map) {
            if (this.map[route].timestamp < now - ROUTE_EXPIRATION_TIME) {
                delete this.map[route];
            }
        }
    }

    async buildGraph() {
        let graph = {};
        for (let route in this.map) {
            graph[route] = this.map[route].map(x => x.route);
            //Remove duplicates
            graph[route] = [...new Set(graph[route])];
        }
        return graph;
    }

    async findShortestRoutes(from, to) {
        if (from === to) {
            return [from];
        }

        let graph = await this.buildGraph();
        let visited = {};
        let queue = [[from]];
        while (queue.length > 0) {
            let path = queue.shift();
            let node = path[path.length - 1];
            if (visited[node]) {
                continue;
            }
            visited[node] = true;
            let neighbours = graph[node];
            if(!neighbours) {
                continue;
            }
            for (let neighbour of neighbours) {
                let newPath = [...path, neighbour];
                if (neighbour === to) {
                    return newPath;
                }
                queue.push(newPath);
            }
        }
        return [];
    }
}
