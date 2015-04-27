pdf('corellation.pdf')
to.read=file('./matrix.bin', 'rb')
d <- readBin(to.read, what='numeric', size=4, n=50000000, endian='little')
h <- hist(d, plot=FALSE)
barplot(h$counts, main='domain pairs correlation', log='y', col='white', ylab='counts', names.arg=h$breaks[-1])
dev.off()

# find 1000th largest
# n <- length(d)
# sort(d,partial=n-1000)[n-1000]
# [1] 0.9938439

# var m = require('../satellite/asn_aggregation/correlation-matrix.js').loadMatrix('matrix')
# var fs = require('fs')
# var result = []
# var domains = Object.keys(m._domains)
#
# for (var i = 0; i < domains.length; i++) {
#     for (var j = i+1; j < domains.length; j++) {
#         if (m.lookup(domains[i],domains[j]) >= 0.9938439) {
#             result.push(domains[i] + ',' + domains[j] + ',' + m.lookup(domains[i],domains[j]))
#         }
#     }
# }
#
# fs.writeFileSync('largest.csv', result.join('\n'))