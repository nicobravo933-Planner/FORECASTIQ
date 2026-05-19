FROM grafana/alloy:latest

# Copiar config al path estándar de Alloy
COPY config.alloy /etc/alloy/config.alloy

# Railway expone un solo puerto público — usamos 12345 para Alloy UI + healthcheck
EXPOSE 12345

# Railway inyecta $PORT pero Alloy no lo usa — lo ignoramos y fijamos 12345
ENTRYPOINT ["alloy", "run", "/etc/alloy/config.alloy", \
            "--server.http.listen-addr=0.0.0.0:12345", \
            "--stability.level=generally-available"]
