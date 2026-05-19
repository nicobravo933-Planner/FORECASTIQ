FROM grafana/alloy:latest

# Copiar config al path estándar de Alloy
COPY config.alloy /etc/alloy/config.alloy

# Puerto métricas propias de Alloy (healthcheck)
EXPOSE 12345
# Puerto receiver de logs HTTP
EXPOSE 3100

ENTRYPOINT ["alloy", "run", "/etc/alloy/config.alloy", "--server.http.listen-addr=0.0.0.0:12345"]
